const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function check() {
  const dir = path.resolve(__dirname, 'excel');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, f));
    console.log(`${f} (${wb.worksheets.length} sheets): ${wb.worksheets.map(w => w.name).join(' | ')}`);
  }
}

check().catch(console.error);
