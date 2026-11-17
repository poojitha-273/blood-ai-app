const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { JWT_SECRET } = require('../middleware/auth');
const { sendAuthTokenEmail, getEmailProviderStatus } = require('../services/emailService');

const router = express.Router();

// In-Memory store for active 6-digit authentication tokens (10 minute expiry)
const activeTokens = new Map();

// 1. Send Authentication Token via Resend Email API
router.post('/send-token', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up if user already exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    // Generate random 6-digit token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    activeTokens.set(normalizedEmail, {
      token,
      expiresAt,
      role: user?.role || role || 'donor',
      name: user?.name || '',
      userId: user?.id || null,
    });

    const requestOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`;

    // Send email using Resend API / Gmail SMTP
    const emailResult = await sendAuthTokenEmail(
      normalizedEmail,
      token,
      user?.role || role || 'donor',
      user?.name || '',
      requestOrigin
    );

    if (!emailResult?.success || emailResult?.deliveryStatus !== 'delivered') {
      activeTokens.delete(normalizedEmail);
      const statusCode = emailResult?.statusCode && emailResult.statusCode >= 400 && emailResult.statusCode < 600
        ? emailResult.statusCode
        : 400;
      return res.status(statusCode).json({
        error:
          emailResult?.message ||
          `Could not deliver authentication token to ${normalizedEmail}. Configure SMTP_USER/SMTP_PASS in server/.env or verify a domain in Resend.`,
        deliveryStatus: emailResult?.deliveryStatus || 'failed',
        needsSmtpCredentials: Boolean(emailResult?.needsSmtpCredentials),
      });
    }

    res.json({
      message: `Authentication token sent to ${normalizedEmail}`,
      email: normalizedEmail,
      deliveryStatus: 'delivered',
      provider: emailResult.provider || 'resend',
      resendId: emailResult.id || null,
      expiresIn: '10 minutes',
    });
  } catch (error) {
    console.error('Send token error:', error);
    res.status(500).json({ error: 'Failed to send authentication token' });
  }
});

// 2. Verify Authentication Token and Log In
router.post('/verify-token', async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: 'Email and verification token are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stored = activeTokens.get(normalizedEmail);

    if (!stored) {
      return res.status(400).json({ error: 'No active token found for this email. Please request a new code.' });
    }

    if (Date.now() > stored.expiresAt) {
      activeTokens.delete(normalizedEmail);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new code.' });
    }

    if (stored.token !== token.trim()) {
      return res.status(400).json({ error: 'Invalid verification token. Please verify the code from your email.' });
    }

    // Token is valid! Remove token
    activeTokens.delete(normalizedEmail);

    // Get or auto-provision user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (!user) {
      // Auto-create user for token sign-in if new
      const defaultName = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
          email: normalizedEmail,
          password: await bcrypt.hash('token-auth-temp-pwd', 10),
          role: stored.role || 'donor',
          is_verified: true,
          reward_points: 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Token verification successful',
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        blood_group: user.blood_group,
        city: user.city,
        state: user.state,
      },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

// 3. Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, city, state, bloodGroup, licenseNumber, license_number } = req.body;
    const finalLicense = licenseNumber || license_number || null;

    // Server-side field validation
    const errors = {};
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const validRoles = ['donor', 'hospital'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role must be either donor or hospital' });
    }

    const trimmedName = (name || '').trim();
    if (trimmedName.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (/^[\d\W]+$/.test(trimmedName)) {
      errors.name = 'Name must contain at least one letter';
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password || password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    const trimmedPhone = (phone || '').replace(/\D/g, '');
    if (trimmedPhone.length < 7) {
      errors.phone = 'Phone number must have at least 7 digits';
    }

    const trimmedCity = (city || '').trim();
    if (trimmedCity.length < 2) {
      errors.city = 'City must be at least 2 characters';
    }

    const trimmedState = (state || '').trim();
    if (trimmedState.length < 2) {
      errors.state = 'State must be at least 2 characters';
    }

    const trimmedAddress = (address || '').trim();
    if (trimmedAddress.length < 5 || !/[a-zA-Z]/.test(trimmedAddress)) {
      errors.address = 'Address must be at least 5 characters and contain letters';
    }

    if (role === 'donor' && (!bloodGroup || !validBloodGroups.includes(bloodGroup))) {
      errors.bloodGroup = 'Please select a valid blood group';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: Object.values(errors)[0], errors });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        phone,
        address,
        city,
        state,
        blood_group: bloodGroup || null,
        license_number: finalLicense,
        is_verified: true,
        reward_points: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Send a welcome token email via Resend
    const welcomeToken = Math.floor(100000 + Math.random() * 900000).toString();
    activeTokens.set(normalizedEmail, {
      token: welcomeToken,
      expiresAt: Date.now() + 10 * 60 * 1000,
      role: user.role,
      name: user.name,
      userId: user.id,
    });
    const requestOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    sendAuthTokenEmail(normalizedEmail, welcomeToken, user.role, user.name, requestOrigin).catch(() => {});

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful. Verification token dispatched to your email via Resend.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 4. Standard Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        blood_group: user.blood_group,
        city: user.city,
        state: user.state
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 5. Profile
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, phone, address, city, state, blood_group, latitude, longitude, is_verified, reward_points, created_at')
      .eq('id', decoded.id)
      .single();

    if (error) throw error;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 7. Report active email provider configuration status (never exposes secrets)
router.get('/email-config', (_req, res) => {
  res.json(getEmailProviderStatus());
});

module.exports = router;
