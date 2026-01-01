type Language = 'th' | 'en'

type TranslationKey = keyof typeof translations.th

const translations = {
  th: {
    // Menu page
    searchPlaceholder: 'ค้นหาเมนู...',
    recommended: 'แนะนำ',
    searchResults: 'ผลการค้นหา',
    items: 'รายการ',
    item: 'รายการ',
    noItemsFound: 'ไม่พบรายการ',
    categories: 'หมวดหมู่',

    // Cart page
    cart: 'ตะกร้า',
    cartEmpty: 'ตะกร้าของคุณยังว่างอยู่',
    cartEmptyDesc: 'เลือกเมนูที่คุณชอบเพื่อเริ่มสั่งอาหาร',
    viewMenu: 'ดูเมนู',
    note: 'หมายเหตุ',
    total: 'รวมทั้งหมด',
    continueToCheckout: 'ดำเนินการชำระเงิน',

    // Menu item
    soldOut: 'หมด',

    // Checkout page
    checkout: 'ชำระเงิน',
    pickupTime: 'เวลารับอาหาร',
    asap: 'โดยเร็ว (ASAP)',
    scheduledPickup: 'กำหนดเวลารับ',
    selectTime: 'เลือกเวลา',
    customerInfo: 'ข้อมูลลูกค้า',
    name: 'ชื่อ',
    namePlaceholder: 'กรอกชื่อของคุณ',
    phone: 'เบอร์โทร',
    phonePlaceholder: '08XXXXXXXX',
    payment: 'ชำระเงิน',
    promptPayInstructions: 'โอนเงินผ่าน PromptPay',
    promptPayNumber: 'หมายเลข PromptPay',
    uploadSlip: 'อัปโหลดสลิป',
    uploadSlipDesc: 'กรุณาแนบหลักฐานการโอนเงิน',
    slipUploaded: 'อัปโหลดสลิปแล้ว',
    changeSlip: 'เปลี่ยนสลิป',
    orderSummary: 'รายการสั่งซื้อ',
    confirmOrder: 'ยืนยันคำสั่งซื้อ',
    pleaseWait: 'กรุณารอสักครู่...',
    orderCreated: 'สร้างคำสั่งซื้อแล้ว',
    orderNumber: 'หมายเลขคำสั่งซื้อ',
    orderConfirmed: 'ยืนยันคำสั่งซื้อแล้ว',
    orderConfirmedDesc: 'ขอบคุณสำหรับคำสั่งซื้อ เราจะเตรียมอาหารของคุณให้',
    backToMenu: 'กลับไปหน้าเมนู',
    orderDetails: 'รายละเอียดคำสั่งซื้อ',
    pickupInfo: 'ข้อมูลการรับอาหาร',
    customerDetails: 'ข้อมูลลูกค้า',
    items: 'รายการ',
    required: '(จำเป็น)',

    // Processing states
    processingUploadingSlip: 'กำลังอัปโหลดสลิปการชำระเงิน… กรุณาอย่าปิดหน้านี้',
    processingCreatingOrder: 'กำลังสร้างคำสั่งซื้อ… กรุณารอสักครู่',
    processingSavingItems: 'กำลังบันทึกรายการอาหาร… ระบบกำลังตรวจสอบข้อมูลคำสั่งซื้อ',

    // Error messages - Step A (ORDER)
    errorOrderTitle: 'ทำรายการไม่สำเร็จ',
    errorOrderMessage: 'ไม่สามารถสร้างคำสั่งซื้อได้ในขณะนี้',
    errorOrderHelper: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง',
    retryOrder: 'ลองอีกครั้ง',
    backToCart: 'กลับไปตะกร้า',

    // Error messages - Step B (ITEMS)
    errorItemsTitle: 'บันทึกรายการอาหารไม่สำเร็จ',
    errorItemsMessage: 'คำสั่งซื้อถูกสร้างแล้ว แต่บันทึกรายการอาหารไม่ครบ',
    errorItemsHelper: 'กรุณาลองอีกครั้ง หากยังพบปัญหาให้ติดต่อร้านพร้อมหมายเลขคำสั่งซื้อ',
    retrySaveItems: 'ลองบันทึกอีกครั้ง',
    showOrderNumber: 'ดูหมายเลขคำสั่งซื้อ',

    // Error messages - Step C (SLIP)
    errorSlipTitle: 'อัปโหลดสลิปไม่สำเร็จ',
    errorSlipMessage: 'ระบบยังไม่ได้รับสลิปการชำระเงิน',
    errorSlipHelper: 'กรุณาลองอัปโหลดอีกครั้ง หรือเปลี่ยนไฟล์รูป',
    retryUploadSlip: 'ลองอัปโหลดอีกครั้ง',
    backToEdit: 'กลับไปแก้ไข',
  },
  en: {
    // Menu page
    searchPlaceholder: 'Search menu...',
    recommended: 'Recommended',
    searchResults: 'Search Results',
    items: 'items',
    item: 'item',
    noItemsFound: 'No items found',
    categories: 'Categories',

    // Cart page
    cart: 'Cart',
    cartEmpty: 'Your cart is empty',
    cartEmptyDesc: 'Choose your favorite menu to start ordering',
    viewMenu: 'View Menu',
    note: 'Note',
    total: 'Total',
    continueToCheckout: 'Continue to Checkout',

    // Menu item
    soldOut: 'Sold out',

    // Checkout page
    checkout: 'Checkout',
    pickupTime: 'Pickup Time',
    asap: 'ASAP',
    scheduledPickup: 'Scheduled Pickup',
    selectTime: 'Select Time',
    customerInfo: 'Customer Information',
    name: 'Name',
    namePlaceholder: 'Enter your name',
    phone: 'Phone',
    phonePlaceholder: '08XXXXXXXX',
    payment: 'Payment',
    promptPayInstructions: 'Transfer via PromptPay',
    promptPayNumber: 'PromptPay Number',
    uploadSlip: 'Upload Slip',
    uploadSlipDesc: 'Please attach payment proof',
    slipUploaded: 'Slip uploaded',
    changeSlip: 'Change slip',
    orderSummary: 'Order Summary',
    confirmOrder: 'Confirm Order',
    pleaseWait: 'Please wait...',
    orderCreated: 'Order created',
    orderNumber: 'Order Number',
    orderConfirmed: 'Order Confirmed',
    orderConfirmedDesc: 'Thank you for your order. We will prepare your food',
    backToMenu: 'Back to Menu',
    orderDetails: 'Order Details',
    pickupInfo: 'Pickup Information',
    customerDetails: 'Customer Details',
    items: 'items',
    required: '(required)',

    // Processing states
    processingUploadingSlip: 'Uploading payment slip… Please do not close this page',
    processingCreatingOrder: 'Creating order… Please wait',
    processingSavingItems: 'Saving items… Validating order data',

    // Error messages - Step A (ORDER)
    errorOrderTitle: 'Order Failed',
    errorOrderMessage: 'Unable to create order at this time',
    errorOrderHelper: 'Please check your internet connection and try again',
    retryOrder: 'Try Again',
    backToCart: 'Back to Cart',

    // Error messages - Step B (ITEMS)
    errorItemsTitle: 'Failed to Save Items',
    errorItemsMessage: 'Order was created but items were not saved completely',
    errorItemsHelper: 'Please try again. If the problem persists, contact us with your order number',
    retrySaveItems: 'Try Saving Again',
    showOrderNumber: 'Show Order Number',

    // Error messages - Step C (SLIP)
    errorSlipTitle: 'Slip Upload Failed',
    errorSlipMessage: 'Payment slip was not received',
    errorSlipHelper: 'Please try uploading again or change the image file',
    retryUploadSlip: 'Try Uploading Again',
    backToEdit: 'Back to Edit',
  },
}

export function translate(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.th[key] || key
}
