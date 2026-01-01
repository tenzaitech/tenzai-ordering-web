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
  },
}

export function translate(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.th[key] || key
}
