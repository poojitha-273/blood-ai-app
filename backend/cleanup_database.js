const supabase = require('./config/supabase');

async function cleanup() {
  console.log('--- Cleaning Up Database ---');
  const client = supabase.rawClient || supabase;

  // 1. Delete test donation history
  console.log('Cleaning test donation history...');
  await client.from('donation_history').delete().eq('donor_id', '456b63b6-eaab-43d1-acef-fe5810db0291');

  // 2. Remove duplicate donation history for pooji (keep 1c1ecb08-475d-4d3a-a113-b7a410fa8618)
  console.log('Deduplicating donation history for pooji...');
  await client.from('donation_history').delete().eq('id', '5ec9d188-4977-4ce3-aedd-37d0d429549c');

  // Set pooji reward points to 150 (1 completed donation)
  await client.from('users').update({ reward_points: 150 }).eq('email', 'pooji@gmail.com');

  // 3. Delete test donor responses & assessments
  const testDonorIds = [
    'fc37e88a-cfaf-4268-9720-f9e06bf66116',
    '48c9aede-edbd-4c1b-9e2b-9124a845dcfc',
    'bcaa9da8-13da-41b8-824b-d0fc2dd57a1f',
    '56b176f4-86c3-409e-af0a-235a6109874a',
    '0b443436-e565-49da-a8bf-aebfdf97318b',
    '456b63b6-eaab-43d1-acef-fe5810db0291'
  ];

  for (const did of testDonorIds) {
    await client.from('donor_responses').delete().eq('donor_id', did);
    await client.from('donor_health_profiles').delete().eq('donor_id', did);
    await client.from('donor_assessments').delete().eq('donor_id', did);
    await client.from('notifications').delete().eq('user_id', did);
    await client.from('users').delete().eq('id', did);
  }

  // 4. Delete test hospital blood requests & hospitals
  const testHospitalIds = [
    '5b11874e-37c7-4072-941e-7d1803d90dd4',
    '6f2b8986-8629-428c-93e5-369f74d867dc',
    'd1f00658-e226-465c-8535-18fc777135c0',
    'e75d762b-eb6c-4a76-ad6c-be65ec36d25b',
    '2fe88945-667d-410f-9352-ea918acaefc6',
    '0afe2b6f-1362-4632-ac62-2e377fba9737'
  ];

  for (const hid of testHospitalIds) {
    await client.from('blood_requests').delete().eq('hospital_id', hid);
    await client.from('notifications').delete().eq('user_id', hid);
    await client.from('users').delete().eq('id', hid);
  }

  // Delete any remaining requests starting with Springfield
  await client.from('blood_requests').delete().ilike('hospital_name', '%Springfield%');

  console.log('✓ Cleanup complete. Inspecting remaining records...');

  const { data: users } = await client.from('users').select('name, email, role');
  console.log('Remaining Users:');
  users?.forEach(u => console.log(` - [${u.role}] ${u.name} (${u.email})`));

  const { data: reqs } = await client.from('blood_requests').select('request_id, hospital_name, blood_group, status');
  console.log('Remaining Blood Requests:');
  reqs?.forEach(r => console.log(` - [${r.status}] ${r.request_id} from ${r.hospital_name} (${r.blood_group})`));

  const { data: hists } = await client.from('donation_history').select('*');
  console.log('Remaining Donation History:');
  hists?.forEach(h => console.log(` - Donor: ${h.donor_id} | Location: ${h.location} | Date: ${h.donation_date} | ID: ${h.id}`));
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

