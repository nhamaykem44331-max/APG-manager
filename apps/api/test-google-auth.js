const { google } = require('googleapis');
require('dotenv').config();

async function testConnection() {
  console.log('--- BẮT ĐẦU TEST KẾT NỐI GOOGLE SHEETS ---');
  try {
    const config = {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    
    if (!config.client_email || !config.private_key) {
      throw new Error('Thiếu cấu hình Email hoặc Private Key trong file .env');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: config,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('1. Đã nạp thông tin xác thực (Credentials OK)');
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;

    console.log(`2. Đang kết nối tới Sheet ID: ${sheetId}...`);

    const res = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const targetSheet = res.data.sheets.find((s) => s.properties.title === sheetName);
    
    if (targetSheet) {
      console.log(`\n🎉 KẾT NỐI THÀNH CÔNG TỚI SHEET: "${sheetName}"`);
      console.log(`Số dòng hiện hữu trên lưới lưới: ${targetSheet.properties.gridProperties.rowCount}`);
    } else {
      console.log(`\n❌ CẢNH BÁO: Đã vào được file, nhưng không tìm thấy Tên Sheet "${sheetName}" (Cần tạo sheet tên này trước)`);
    }

  } catch (error) {
    console.error('\n❌ LỖI KẾT NỐI:', error.message);
    if (error.message.includes('permission')) {
       console.error('=> TÀI KHOẢN CHƯA ĐƯỢC CẤP QUYỀN. Vui lòng Share file sheet cho luồng email Service Account với quyền Editor.');
    }
  }
}

testConnection();
