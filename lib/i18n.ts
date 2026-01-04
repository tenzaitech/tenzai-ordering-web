type Language = 'th' | 'en'

type TranslationKey = keyof typeof translations.th

const translations = {
  th: {
    // ============================================
    // COMMON / SHARED
    // ============================================
    loading: 'กำลังโหลด...',
    pleaseWait: 'กรุณารอสักครู่...',
    retry: 'ลองใหม่',
    cancel: 'ยกเลิก',
    save: 'บันทึก',
    saving: 'กำลังบันทึก...',
    confirm: 'ยืนยัน',
    back: 'กลับ',
    close: 'ปิด',
    edit: 'แก้ไข',
    delete: 'ลบ',
    deleting: 'กำลังลบ...',
    create: 'สร้าง',
    creating: 'กำลังสร้าง...',
    updating: 'กำลังอัปเดต...',
    processing: 'กำลังดำเนินการ...',
    required: '(จำเป็น)',
    optional: '(ไม่บังคับ)',
    note: 'หมายเหตุ',
    total: 'รวมทั้งหมด',
    items: 'รายการ',
    item: 'รายการ',
    noItemsFound: 'ไม่พบรายการ',
    errorGeneric: 'เกิดข้อผิดพลาด',
    errorGenericMessage: 'ไม่สามารถดำเนินการได้',
    unauthorized: 'ไม่ได้รับอนุญาต (คีย์ผู้ดูแลหายไปหรือไม่ถูกต้อง)',
    copiedToClipboard: 'คัดลอกแล้ว',

    // ============================================
    // MENU PAGE
    // ============================================
    searchPlaceholder: 'ค้นหาเมนู...',
    recommended: 'แนะนำ',
    searchResults: 'ผลการค้นหา',
    categories: 'หมวดหมู่',
    soldOut: 'หมด',

    // ============================================
    // CART PAGE
    // ============================================
    cart: 'ตะกร้า',
    cartEmpty: 'ตะกร้าของคุณยังว่างอยู่',
    cartEmptyDesc: 'เลือกเมนูที่คุณชอบเพื่อเริ่มสั่งอาหาร',
    viewMenu: 'ดูเมนู',
    continueToCheckout: 'ดำเนินการชำระเงิน',
    addMore: 'สั่งเพิ่ม',

    // ============================================
    // CHECKOUT PAGE
    // ============================================
    checkout: 'ชำระเงิน',
    customerInfo: 'ข้อมูลลูกค้า',
    name: 'ชื่อ',
    namePlaceholder: 'กรอกชื่อของคุณ',
    phone: 'เบอร์โทร',
    phonePlaceholder: '08XXXXXXXX',
    pickupTime: 'เวลารับอาหาร',
    pickupType: 'รูปแบบรับ',
    asap: 'โดยเร็ว (ASAP)',
    asapFull: 'ให้ร้านทำทันที',
    scheduledPickup: 'กำหนดเวลารับ',
    scheduled: 'นัดเวลารับ',
    selectTime: 'เลือกเวลา',
    orderSummary: 'รายการสั่งซื้อ',
    noteToRestaurant: 'หมายเหตุถึงร้าน',
    noteToRestaurantPlaceholder: 'เช่น ไม่ใส่วาซาบิ / แพ้อาหาร / ฝากบอกพนักงาน…',
    goToPayment: 'ไปหน้าชำระเงิน',
    fillAllFields: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    selectPickupTime: 'กรุณาเลือกเวลารับอาหาร',
    invalidItemsDetected: 'พบรายการที่ไม่ถูกต้อง กรุณาลบและเพิ่มรายการใหม่',

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

    // ============================================
    // PAYMENT PAGE
    // ============================================
    payment: 'ชำระเงิน',
    promptPayInstructions: 'โอนเงินผ่าน PromptPay',
    promptPayNumber: 'หมายเลข PromptPay',
    promptPay: 'พร้อมเพย์',
    amount: 'ยอดชำระ',
    uploadSlip: 'อัปโหลดสลิป',
    uploadSlipDesc: 'กรุณาแนบหลักฐานการโอนเงิน',
    slipUploaded: 'อัปโหลดสลิปแล้ว',
    changeSlip: 'เปลี่ยนสลิป',
    confirmOrder: 'ยืนยันคำสั่งซื้อ',
    orderNotFound: 'ไม่พบคำสั่งซื้อ',
    orderNotFoundDesc: 'กรุณากลับไปหน้าชำระเงินและลองใหม่อีกครั้ง',
    backToCheckout: 'กลับไปหน้าชำระเงิน',
    orderLocked: 'ล็อคแล้ว (อัปสลิปแล้ว)',
    editItems: 'แก้ไขรายการ',
    updatingTotal: 'กำลังอัปเดตยอดรวม…',
    generatingQR: 'กำลังสร้าง QR...',
    saveQR: 'บันทึก QR',
    pleaseAttachSlip: 'กรุณาแนบสลิปการชำระเงิน',
    collapse: 'ย่อ',
    showAll: 'แสดงทั้งหมด',

    // ============================================
    // CONFIRMED PAGE
    // ============================================
    orderCreated: 'สร้างคำสั่งซื้อแล้ว',
    orderNumber: 'หมายเลขคำสั่งซื้อ',
    orderConfirmed: 'ยืนยันคำสั่งซื้อแล้ว',
    orderConfirmedDesc: 'ขอบคุณสำหรับคำสั่งซื้อ เราจะเตรียมอาหารของคุณให้',
    orderDetails: 'รายละเอียดคำสั่งซื้อ',
    pickupInfo: 'ข้อมูลการรับอาหาร',
    customerDetails: 'ข้อมูลลูกค้า',
    backToMenu: 'กลับไปหน้าเมนู',
    orderReceived: 'เราได้รับออเดอร์แล้ว',
    statusWaitingApproval: 'สถานะ: รออนุมัติ',
    viewMyOrders: 'ดูออเดอร์ของฉัน',
    couldNotLoadOrder: 'ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง',

    // ============================================
    // ORDER STATUS PAGE
    // ============================================
    myOrders: 'ออเดอร์ของฉัน',
    noOrders: 'ยังไม่มีออเดอร์',
    noOrdersDesc: 'เมื่อคุณสั่งอาหาร ออเดอร์จะแสดงที่นี่',
    order: 'ออเดอร์',
    status: 'สถานะ',
    statusPending: 'รอตรวจสอบ',
    statusApproved: 'อนุมัติแล้ว',
    statusRejected: 'ปฏิเสธ',
    statusReady: 'พร้อมรับ',
    statusPickedUp: 'รับแล้ว',
    slipNotUploaded: 'ยังไม่ได้อัปสลิป',
    orderedAt: 'สั่งเมื่อ',
    orderNotFoundDetail: 'ออเดอร์นี้ไม่พบหรือคุณไม่มีสิทธิ์เข้าถึง',
    goBack: 'กลับไปหน้าออเดอร์',
    unableToLoadOrders: 'ไม่สามารถโหลดออเดอร์ได้',
    unableToLoadData: 'ไม่สามารถโหลดข้อมูลได้',

    // ============================================
    // LIFF PAGE
    // ============================================
    liffNotConfigured: 'ยังไม่ได้ตั้งค่า LIFF',
    failedToCreateSession: 'ไม่สามารถสร้างเซสชันได้',
    pleaseOpenInLine: 'กรุณาเปิดหน้านี้ใน LINE',
    openInLine: 'เปิดใน LINE',
    ifNotOpenTapHere: 'หากไม่เปิด ให้แตะที่นี่',
    connectionError: 'เชื่อมต่อไม่สำเร็จ',
    connectingLine: 'กำลังเชื่อมต่อ LINE…',
    loggingIn: 'กำลังเข้าสู่ระบบ…',
    liffInstructionsIOS: 'แตะ "เปิดใน LINE" ด้านล่าง หากมีการถาม ให้เลือก "เปิด"',
    liffInstructionsAndroid: 'แตะ "เปิดใน LINE" ด้านล่าง หากมีการถาม ให้อนุญาตเปิดใน LINE',
    liffInstructionsDesktop: 'กรุณาเปิดลิงก์นี้บนโทรศัพท์ในแอป LINE',

    // ============================================
    // CLOSED PAGE
    // ============================================
    shopClosedTitle: 'ร้านปิดรับออเดอร์ชั่วคราว',
    shopClosedMessage: 'ขออภัยในความไม่สะดวกครับ\n\nสามารถดูเมนูได้ที่ปุ่ม MENU\nในหน้าแชท LINE ของร้าน',

    // ============================================
    // ITEM DETAIL PAGE
    // ============================================
    itemDetails: 'รายละเอียดสินค้า',
    editItem: 'แก้ไขรายการ',
    addItem: 'เพิ่มรายการ',
    specialInstructions: 'คำขอพิเศษ',
    specialInstructionsPlaceholder: 'เพิ่มคำขอพิเศษที่นี่ (ถ้ามี)',
    quantity: 'จำนวน',
    saveChanges: 'บันทึกการเปลี่ยนแปลง',
    addToCart: 'เพิ่มลงตะกร้า',
    addToOrder: 'เพิ่มลงออเดอร์',
    itemUpdated: 'แก้ไขรายการแล้ว',
    addedToCart: 'เพิ่มลงตะกร้าแล้ว',
    pleaseSelect: 'กรุณาเลือก',
    selectAtLeast: 'กรุณาเลือกอย่างน้อย',
    adding: 'กำลังเพิ่ม...',
    failedToAddItem: 'เพิ่มรายการไม่สำเร็จ',

    // ============================================
    // ADMIN NAVIGATION
    // ============================================
    dashboard: 'แดชบอร์ด',
    orders: 'คำสั่งซื้อ',
    staff: 'พนักงาน',
    menu: 'เมนู',
    category: 'หมวดหมู่',
    options: 'ตัวเลือก',
    importExport: 'นำเข้า/ส่งออก',
    settings: 'ตั้งค่า',

    // ============================================
    // ADMIN DASHBOARD
    // ============================================
    operations: 'การดำเนินงาน',
    restaurantManagement: 'การจัดการร้านอาหาร',
    ordersDesc: 'ดูและจัดการคำสั่งซื้อ',
    menuDesc: 'รายการ ราคา และความพร้อมจำหน่าย',
    categoriesDesc: 'จัดระเบียบโครงสร้างเมนู',
    optionsDesc: 'การปรับแต่งและส่วนเสริม',
    importExportDesc: 'การจัดการข้อมูลจำนวนมาก',

    // ============================================
    // ADMIN ORDERS PAGE
    // ============================================
    adminOrders: 'ผู้ดูแล - คำสั่งซื้อ',
    loadingOrders: 'กำลังโหลดคำสั่งซื้อ...',
    orderAccepting: 'การรับคำสั่งซื้อ',
    open: 'เปิด',
    closed: 'ปิด',
    customersCanOrder: 'ลูกค้าสามารถสั่งอาหารได้',
    customersBlocked: 'ลูกค้าไม่สามารถสั่งอาหารได้',
    closeShop: 'ปิดร้าน',
    openShop: 'เปิดร้าน',
    customer: 'ลูกค้า',
    pickup: 'รับสินค้า',
    noOrdersFound: 'ไม่พบคำสั่งซื้อ',
    immediate: 'ทันที',
    filterStatus: 'สถานะ',
    filterDate: 'วันที่',
    filterAll: 'ทั้งหมด',
    filterToday: 'วันนี้',
    filterPending: 'รอดำเนินการ',
    filterApproved: 'อนุมัติแล้ว',
    filterRejected: 'ปฏิเสธแล้ว',
    filterReady: 'พร้อมรับ',
    filterPickedUp: 'รับแล้ว',
    search: 'ค้นหา',
    searchPlaceholderAdmin: 'เลขออเดอร์, ชื่อ, เบอร์โทร...',
    showing: 'แสดง',
    of: 'จาก',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    page: 'หน้า',
    created: 'สร้างเมื่อ',
    customerInfo: 'ข้อมูลลูกค้า',
    pickupInfo: 'ข้อมูลการรับ',
    totalAmount: 'ยอดรวม',
    paymentSlip: 'สลิปการชำระเงิน',
    openSlip: 'ดูสลิป',
    noSlipUploaded: 'ยังไม่ได้อัปโหลดสลิป',
    customerNote: 'หมายเหตุจากลูกค้า',
    orderItems: 'รายการสั่งซื้อ',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    confirmApprove: 'อนุมัติคำสั่งซื้อนี้และแจ้งทีมครัว?',
    confirmOpenShop: 'เปิดรับออเดอร์อีกครั้ง?',
    confirmCloseShop: 'ปิดรับออเดอร์ชั่วคราว?',
    shopOpened: 'เปิดรับออเดอร์แล้ว',
    shopClosed: 'ปิดรับออเดอร์แล้ว',
    orderApprovedSuccess: 'อนุมัติคำสั่งซื้อสำเร็จ',
    orderApprovedError: 'ไม่สามารถอนุมัติคำสั่งซื้อได้',
    orderRejectedSuccess: 'ปฏิเสธคำสั่งซื้อสำเร็จ',
    orderRejectedError: 'ไม่สามารถปฏิเสธคำสั่งซื้อได้',
    rejectOrder: 'ปฏิเสธคำสั่งซื้อ',
    rejectReasonOptional: 'เหตุผล (ไม่บังคับ)',
    rejectReasonPlaceholder: 'เช่น สินค้าหมด, การชำระเงินไม่ถูกต้อง...',
    confirmReject: 'ยืนยันปฏิเสธ',

    // ============================================
    // ADMIN SETTINGS PAGE
    // ============================================
    systemSettings: 'ตั้งค่าระบบ',
    loadingSettings: 'กำลังโหลดการตั้งค่า...',
    promptPayIdLabel: 'หมายเลข PromptPay',
    promptPayIdDesc: 'เบอร์โทรหรือเลขบัตรประชาชนสำหรับรับเงินผ่าน PromptPay',
    promptPayIdFormat: 'รูปแบบ: 0XXXXXXXXX (10 หลัก) หรือเลขบัตรประชาชน 13 หลัก',
    lineApproverIdLabel: 'LINE Approver ID',
    lineApproverIdDesc: 'LINE User ID ที่จะได้รับแจ้งเตือนออเดอร์ใหม่ (สำหรับอนุมัติ)',
    lineStaffIdLabel: 'LINE Staff ID',
    lineStaffIdDesc: 'LINE User/Group ID ที่จะได้รับแจ้งเตือนออเดอร์ที่อนุมัติแล้ว (พนักงานครัว)',
    changeStaffPin: 'เปลี่ยน Staff PIN',
    changeStaffPinDesc: 'PIN 4 หลักสำหรับเข้าใช้งาน Staff Board',
    changeStaffPinWarning: 'การเปลี่ยน PIN จะทำให้พนักงานทั้งหมดต้องเข้าสู่ระบบใหม่',
    leaveEmptyToKeepPin: 'เว้นว่างเพื่อใช้ PIN เดิม',
    test: 'ทดสอบ',
    sending: 'กำลังส่ง...',
    noChanges: 'ไม่มีการเปลี่ยนแปลง',
    saveSettings: 'บันทึกการตั้งค่า',
    settingsSaved: 'บันทึกการตั้งค่าสำเร็จ!',
    settingsSavedWithPin: 'บันทึกการตั้งค่าสำเร็จ! PIN ถูกเปลี่ยน - พนักงานทั้งหมดจะต้องเข้าสู่ระบบใหม่',
    failedToLoadSettings: 'โหลดการตั้งค่าไม่สำเร็จ',
    failedToSaveSettings: 'บันทึกการตั้งค่าไม่สำเร็จ',
    adminAccessRequired: 'ต้องมีสิทธิ์ Admin กรุณาเข้าผ่าน /admin/menu ก่อน',
    pinMustBe4Digits: 'PIN ต้องเป็นตัวเลข 4 หลัก',
    noChangesToSave: 'ไม่มีการเปลี่ยนแปลงที่จะบันทึก',
    testMessageSent: 'ส่งข้อความทดสอบสำเร็จ!',
    failedToSendTestMessage: 'ส่งข้อความทดสอบไม่สำเร็จ',

    // ============================================
    // ADMIN MENU MANAGEMENT
    // ============================================
    menuManagement: 'การจัดการเมนู',
    createNewItem: '+ สร้างรายการใหม่',
    searchByNameOrCode: 'ค้นหาด้วยชื่อหรือรหัส...',
    allCategories: 'หมวดหมู่ทั้งหมด',
    noMenuItemsFound: 'ไม่พบรายการเมนู',
    tryAdjustingFilters: 'ลองปรับการค้นหาหรือตัวกรอง',
    getStartedByCreating: 'เริ่มต้นด้วยการสร้างรายการเมนูแรกของคุณ',
    createFirstMenuItem: '+ สร้างรายการเมนูแรก',
    image: 'รูปภาพ',
    code: 'รหัส',
    nameTh: 'ชื่อ (ไทย)',
    nameEn: 'ชื่อ (อังกฤษ)',
    price: 'ราคา',
    updated: 'อัปเดต',
    noImage: 'ไม่มีรูป',
    active: 'ใช้งาน',
    inactive: 'ไม่ใช้งาน',
    setInactive: 'ตั้งเป็นไม่ใช้งาน',
    setActive: 'ตั้งเป็นใช้งาน',
    menuActivated: 'เปิดใช้งานเมนูแล้ว',
    menuDeactivated: 'ปิดใช้งานเมนูแล้ว',
    failedToToggle: 'ไม่สามารถเปลี่ยนสถานะได้',
    deleteMenuItem: 'ลบรายการเมนู',
    confirmDeleteMenu: 'คุณแน่ใจหรือไม่ว่าต้องการลบ',
    actionCannotBeUndone: 'การดำเนินการนี้ไม่สามารถยกเลิกได้',
    menuItemDeleted: 'ลบรายการเมนูแล้ว',

    // ============================================
    // ADMIN CATEGORY MANAGEMENT
    // ============================================
    categoryManagement: 'การจัดการหมวดหมู่',
    createCategory: '+ สร้างหมวดหมู่',
    createNewCategory: 'สร้างหมวดหมู่ใหม่',
    enterCategoryName: 'ป้อนชื่อหมวดหมู่...',
    categoryNameRequired: 'ต้องระบุชื่อหมวดหมู่',
    categoryCreated: 'สร้างหมวดหมู่แล้ว',
    categoryUpdated: 'อัปเดตหมวดหมู่แล้ว',
    categoryDeleted: 'ลบหมวดหมู่แล้ว',
    menuItems: 'รายการเมนู',
    actions: 'การดำเนินการ',
    noCategoriesFound: 'ไม่พบหมวดหมู่',
    getStartedByCreatingCategory: 'เริ่มต้นด้วยการสร้างหมวดหมู่แรกของคุณ',
    createFirstCategory: '+ สร้างหมวดหมู่แรก',
    rename: 'เปลี่ยนชื่อ',
    cannotDeleteCategory: 'ไม่สามารถลบหมวดหมู่: มีรายการเมนู',
    deleteCategory: 'ลบหมวดหมู่',
  },
  en: {
    // ============================================
    // COMMON / SHARED
    // ============================================
    loading: 'Loading...',
    pleaseWait: 'Please wait...',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    confirm: 'Confirm',
    back: 'Back',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    deleting: 'Deleting...',
    create: 'Create',
    creating: 'Creating...',
    updating: 'Updating...',
    processing: 'Processing...',
    required: '(required)',
    optional: '(Optional)',
    note: 'Note',
    total: 'Total',
    items: 'items',
    item: 'item',
    noItemsFound: 'No items found',
    errorGeneric: 'Error',
    errorGenericMessage: 'Unable to process request',
    unauthorized: 'Unauthorized (admin key missing/invalid)',
    copiedToClipboard: 'Copied',

    // ============================================
    // MENU PAGE
    // ============================================
    searchPlaceholder: 'Search menu...',
    recommended: 'Recommended',
    searchResults: 'Search Results',
    categories: 'Categories',
    soldOut: 'Sold out',

    // ============================================
    // CART PAGE
    // ============================================
    cart: 'Cart',
    cartEmpty: 'Your cart is empty',
    cartEmptyDesc: 'Choose your favorite menu to start ordering',
    viewMenu: 'View Menu',
    continueToCheckout: 'Continue to Checkout',
    addMore: 'Add more',

    // ============================================
    // CHECKOUT PAGE
    // ============================================
    checkout: 'Checkout',
    customerInfo: 'Customer Information',
    name: 'Name',
    namePlaceholder: 'Enter your name',
    phone: 'Phone',
    phonePlaceholder: '08XXXXXXXX',
    pickupTime: 'Pickup Time',
    pickupType: 'Pickup Type',
    asap: 'ASAP',
    asapFull: 'Prepare immediately',
    scheduledPickup: 'Scheduled Pickup',
    scheduled: 'Scheduled',
    selectTime: 'Select Time',
    orderSummary: 'Order Summary',
    noteToRestaurant: 'Note to Restaurant',
    noteToRestaurantPlaceholder: 'e.g. No wasabi / Allergies / Special instructions…',
    goToPayment: 'Go to Payment',
    fillAllFields: 'Please fill in all required fields',
    selectPickupTime: 'Please select pickup time',
    invalidItemsDetected: 'Invalid items detected. Please remove and re-add them.',

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

    // ============================================
    // PAYMENT PAGE
    // ============================================
    payment: 'Payment',
    promptPayInstructions: 'Transfer via PromptPay',
    promptPayNumber: 'PromptPay Number',
    promptPay: 'PromptPay',
    amount: 'Amount',
    uploadSlip: 'Upload Slip',
    uploadSlipDesc: 'Please attach payment proof',
    slipUploaded: 'Slip uploaded',
    changeSlip: 'Change slip',
    confirmOrder: 'Confirm Order',
    orderNotFound: 'Order Not Found',
    orderNotFoundDesc: 'Please go back to checkout and try again',
    backToCheckout: 'Back to Checkout',
    orderLocked: 'Locked (slip uploaded)',
    editItems: 'Edit Items',
    updatingTotal: 'Updating total…',
    generatingQR: 'Generating QR...',
    saveQR: 'Save QR',
    pleaseAttachSlip: 'Please attach payment slip',
    collapse: 'Collapse',
    showAll: 'Show all',

    // ============================================
    // CONFIRMED PAGE
    // ============================================
    orderCreated: 'Order created',
    orderNumber: 'Order Number',
    orderConfirmed: 'Order Confirmed',
    orderConfirmedDesc: 'Thank you for your order. We will prepare your food',
    orderDetails: 'Order Details',
    pickupInfo: 'Pickup Information',
    customerDetails: 'Customer Details',
    backToMenu: 'Back to Menu',
    orderReceived: 'We received your order',
    statusWaitingApproval: 'Status: Waiting for approval',
    viewMyOrders: 'View My Orders',
    couldNotLoadOrder: 'Could not load order information. Please try again',

    // ============================================
    // ORDER STATUS PAGE
    // ============================================
    myOrders: 'My Orders',
    noOrders: 'No orders yet',
    noOrdersDesc: 'When you place an order, it will appear here',
    order: 'Order',
    status: 'Status',
    statusPending: 'Pending',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    statusReady: 'Ready',
    statusPickedUp: 'Picked Up',
    slipNotUploaded: 'Slip not uploaded',
    orderedAt: 'Ordered at',
    orderNotFoundDetail: 'This order was not found or you do not have access.',
    goBack: 'Go Back',
    unableToLoadOrders: 'Unable to load orders',
    unableToLoadData: 'Unable to load data',

    // ============================================
    // LIFF PAGE
    // ============================================
    liffNotConfigured: 'LIFF ID not configured',
    failedToCreateSession: 'Failed to create session',
    pleaseOpenInLine: 'Please open this page in LINE',
    openInLine: 'Open in LINE',
    ifNotOpenTapHere: 'If it doesn\'t open, tap here',
    connectionError: 'Connection Error',
    connectingLine: 'Connecting LINE…',
    loggingIn: 'Logging in…',
    liffInstructionsIOS: 'Tap "Open in LINE" below. If prompted, choose "Open".',
    liffInstructionsAndroid: 'Tap "Open in LINE" below. If prompted, allow opening in LINE.',
    liffInstructionsDesktop: 'Please open this link on your phone in the LINE app.',

    // ============================================
    // CLOSED PAGE
    // ============================================
    shopClosedTitle: 'Shop is temporarily closed',
    shopClosedMessage: 'We apologize for the inconvenience.\n\nYou can view the menu using the MENU button\nin the LINE chat.',

    // ============================================
    // ITEM DETAIL PAGE
    // ============================================
    itemDetails: 'Item Details',
    editItem: 'Edit Item',
    addItem: 'Add Item',
    specialInstructions: 'Special Instructions',
    specialInstructionsPlaceholder: 'Add any special requests here (optional)',
    quantity: 'Quantity',
    saveChanges: 'Save Changes',
    addToCart: 'Add to Cart',
    addToOrder: 'Add to Order',
    itemUpdated: 'Item updated',
    addedToCart: 'Added to cart',
    pleaseSelect: 'Please select',
    selectAtLeast: 'Select at least',
    adding: 'Adding...',
    failedToAddItem: 'Failed to add item',

    // ============================================
    // ADMIN NAVIGATION
    // ============================================
    dashboard: 'Dashboard',
    orders: 'Orders',
    staff: 'Staff',
    menu: 'Menu',
    category: 'Category',
    options: 'Options',
    importExport: 'Import/Export',
    settings: 'Settings',

    // ============================================
    // ADMIN DASHBOARD
    // ============================================
    operations: 'Operations',
    restaurantManagement: 'Restaurant management',
    ordersDesc: 'View and manage customer orders',
    menuDesc: 'Items, prices, and availability',
    categoriesDesc: 'Organize menu structure',
    optionsDesc: 'Customizations and add-ons',
    importExportDesc: 'Bulk data operations',

    // ============================================
    // ADMIN ORDERS PAGE
    // ============================================
    adminOrders: 'Admin - Orders',
    loadingOrders: 'Loading orders...',
    orderAccepting: 'Order Accepting',
    open: 'OPEN',
    closed: 'CLOSED',
    customersCanOrder: 'Customers can place orders',
    customersBlocked: 'Customers are blocked from ordering',
    closeShop: 'Close Shop',
    openShop: 'Open Shop',
    customer: 'Customer',
    pickup: 'Pickup',
    noOrdersFound: 'No orders found',
    immediate: 'ASAP',
    filterStatus: 'Status',
    filterDate: 'Date',
    filterAll: 'All',
    filterToday: 'Today',
    filterPending: 'Pending',
    filterApproved: 'Approved',
    filterRejected: 'Rejected',
    filterReady: 'Ready',
    filterPickedUp: 'Picked Up',
    search: 'Search',
    searchPlaceholderAdmin: 'Order #, name, phone...',
    showing: 'Showing',
    of: 'of',
    prev: 'Prev',
    next: 'Next',
    page: 'Page',
    created: 'Created',
    customerInfo: 'Customer Information',
    pickupInfo: 'Pickup Information',
    totalAmount: 'Total Amount',
    paymentSlip: 'Payment Slip',
    openSlip: 'Open Slip',
    noSlipUploaded: 'No slip uploaded',
    customerNote: 'Customer Note',
    orderItems: 'Order Items',
    approve: 'Approve',
    reject: 'Reject',
    confirmApprove: 'Approve this order and notify kitchen?',
    confirmOpenShop: 'Open shop for orders?',
    confirmCloseShop: 'Temporarily close shop?',
    shopOpened: 'Shop is now open',
    shopClosed: 'Shop is now closed',
    orderApprovedSuccess: 'Order approved successfully',
    orderApprovedError: 'Failed to approve order',
    orderRejectedSuccess: 'Order rejected successfully',
    orderRejectedError: 'Failed to reject order',
    rejectOrder: 'Reject Order',
    rejectReasonOptional: 'Reason (optional)',
    rejectReasonPlaceholder: 'e.g., Out of stock, Invalid payment...',
    confirmReject: 'Confirm Reject',

    // ============================================
    // ADMIN SETTINGS PAGE
    // ============================================
    systemSettings: 'System Settings',
    loadingSettings: 'Loading settings...',
    promptPayIdLabel: 'PromptPay ID',
    promptPayIdDesc: 'Phone number or National ID for receiving PromptPay payments.',
    promptPayIdFormat: 'Format: 0XXXXXXXXX (10 digits) or 13-digit National ID',
    lineApproverIdLabel: 'LINE Approver ID',
    lineApproverIdDesc: 'LINE User ID that receives new order notifications (for payment approval).',
    lineStaffIdLabel: 'LINE Staff ID',
    lineStaffIdDesc: 'LINE User/Group ID that receives approved order notifications (kitchen staff).',
    changeStaffPin: 'Change Staff PIN',
    changeStaffPinDesc: '4-digit PIN for staff board access.',
    changeStaffPinWarning: 'Changing PIN will log out all staff on their next request.',
    leaveEmptyToKeepPin: 'Leave empty to keep current PIN',
    test: 'Test',
    sending: 'Sending...',
    noChanges: 'No Changes',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully!',
    settingsSavedWithPin: 'Settings saved! Staff PIN changed - all staff sessions will be invalidated.',
    failedToLoadSettings: 'Failed to load settings',
    failedToSaveSettings: 'Failed to save settings',
    adminAccessRequired: 'Admin access required. Please access via /admin/menu first.',
    pinMustBe4Digits: 'PIN must be exactly 4 digits',
    noChangesToSave: 'No changes to save',
    testMessageSent: 'Test message sent!',
    failedToSendTestMessage: 'Failed to send test message',

    // ============================================
    // ADMIN MENU MANAGEMENT
    // ============================================
    menuManagement: 'Menu Management',
    createNewItem: '+ Create New Item',
    searchByNameOrCode: 'Search by name or code...',
    allCategories: 'All Categories',
    noMenuItemsFound: 'No menu items found',
    tryAdjustingFilters: 'Try adjusting your search or filters',
    getStartedByCreating: 'Get started by creating your first menu item',
    createFirstMenuItem: '+ Create First Menu Item',
    image: 'Image',
    code: 'Code',
    nameTh: 'Name (TH)',
    nameEn: 'Name (EN)',
    price: 'Price',
    updated: 'Updated',
    noImage: 'No image',
    active: 'Active',
    inactive: 'Inactive',
    setInactive: 'Set Inactive',
    setActive: 'Set Active',
    menuActivated: 'Menu activated successfully',
    menuDeactivated: 'Menu deactivated successfully',
    failedToToggle: 'Failed to toggle active status',
    deleteMenuItem: 'Delete Menu Item',
    confirmDeleteMenu: 'Are you sure you want to delete',
    actionCannotBeUndone: 'This action cannot be undone',
    menuItemDeleted: 'Menu item deleted successfully',

    // ============================================
    // ADMIN CATEGORY MANAGEMENT
    // ============================================
    categoryManagement: 'Category Management',
    createCategory: '+ Create Category',
    createNewCategory: 'Create New Category',
    enterCategoryName: 'Enter category name...',
    categoryNameRequired: 'Category name is required',
    categoryCreated: 'Category created successfully',
    categoryUpdated: 'Category updated successfully',
    categoryDeleted: 'Category deleted successfully',
    menuItems: 'Menu Items',
    actions: 'Actions',
    noCategoriesFound: 'No categories found',
    getStartedByCreatingCategory: 'Get started by creating your first category',
    createFirstCategory: '+ Create First Category',
    rename: 'Rename',
    cannotDeleteCategory: 'Cannot delete category: menu items are using this category',
    deleteCategory: 'Delete Category',
  },
}

export function translate(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.th[key] || key
}
