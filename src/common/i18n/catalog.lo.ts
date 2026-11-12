/**
 * Lao (ລາວ) translations of the API's messages.
 *
 * KEY   = the English template exactly as written in code ({0}, {1} = parameters)
 * VALUE = the Lao template (parameters can move to fit Lao word order)
 *
 * A message missing here is returned in English, so adding a new error never
 * breaks anything. Keep the keys in sync when you reword an English message
 * (the i18n unit test lists every template used in src/).
 */
export const LO_MESSAGES: Record<string, string> = {
  // ---------------------------------------------------------------- generic
  'Request validation failed': 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ',
  'Internal server error': 'ເກີດຂໍ້ຜິດພາດໃນລະບົບ, ກະລຸນາລອງໃໝ່ພາຍຫຼັງ',
  'Something went wrong': 'ເກີດຂໍ້ຜິດພາດ',
  'This record already exists': 'ຂໍ້ມູນນີ້ມີຢູ່ແລ້ວ',
  'This record is still referenced by other data': 'ຂໍ້ມູນນີ້ຍັງຖືກໃຊ້ຢູ່ໃນຂໍ້ມູນອື່ນ',
  'Temporarily unavailable, please try again': 'ລະບົບບໍ່ພ້ອມໃຊ້ງານຊົ່ວຄາວ, ກະລຸນາລອງໃໝ່',
  'Route not found': 'ບໍ່ພົບເສັ້ນທາງ API ນີ້',
  'File too large': 'ໄຟລ໌ໃຫຍ່ເກີນໄປ',
  '{0} {1} not found': 'ບໍ່ພົບ{0} {1}',
  '{0} {1} is not deleted': '{0} {1} ບໍ່ໄດ້ຖືກລຶບ',

  // ---------------------------------------------------------------- auth
  'Authentication required': 'ກະລຸນາເຂົ້າສູ່ລະບົບ',
  'Incorrect username or password': 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
  'Invalid token': 'Token ບໍ່ຖືກຕ້ອງ',
  'Token has expired, please log in again': 'Token ໝົດອາຍຸແລ້ວ, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່',
  'Token has been revoked, please log in again': 'Token ຖືກຍົກເລີກແລ້ວ, ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່',
  'This endpoint needs a user token': 'ຕ້ອງໃຊ້ token ຂອງຜູ້ດູແລລະບົບ',
  'This endpoint needs an owner token': 'ຕ້ອງໃຊ້ token ຂອງຮ້ານ',
  'Account no longer exists': 'ບັນຊີນີ້ບໍ່ມີຢູ່ແລ້ວ',
  'This account is disabled': 'ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ',
  'This store is blocked': 'ຮ້ານນີ້ຖືກລະງັບການໃຊ້ງານ',
  'Too many requests': 'ມີການຮ້ອງຂໍຫຼາຍເກີນໄປ',
  'Too many login attempts': 'ພະຍາຍາມເຂົ້າສູ່ລະບົບຫຼາຍເກີນໄປ',
  '{0}. Try again in {1} seconds': '{0}. ກະລຸນາລອງໃໝ່ໃນອີກ {1} ວິນາທີ',

  // ---------------------------------------------------------------- permissions
  'You can only access your own store': 'ທ່ານເຂົ້າເຖິງໄດ້ສະເພາະຮ້ານຂອງທ່ານເທົ່ານັ້ນ',
  'You can only create records in your own store': 'ທ່ານສ້າງຂໍ້ມູນໄດ້ສະເພາະໃນຮ້ານຂອງທ່ານເທົ່ານັ້ນ',
  'Only admin users can do this': 'ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ເຮັດໄດ້',
  "Only the store's owner can do this": 'ສະເພາະເຈົ້າຂອງຮ້ານເທົ່ານັ້ນທີ່ເຮັດໄດ້',
  'store_id is required': 'ກະລຸນາລະບຸ store_id',
  'owner_id is required': 'ກະລຸນາລະບຸ owner_id',

  // ---------------------------------------------------------------- accounts
  "Username '{0}' is already taken": "ຊື່ຜູ້ໃຊ້ '{0}' ຖືກໃຊ້ແລ້ວ",
  "Phone '{0}' is already registered": "ເບີໂທ '{0}' ຖືກລົງທະບຽນແລ້ວ",
  "Phone '{0}' is already registered in this store": "ເບີໂທ '{0}' ຖືກລົງທະບຽນໃນຮ້ານນີ້ແລ້ວ",
  "Phone '{0}' belongs to deleted customer {1}; restore it instead":
    "ເບີໂທ '{0}' ເປັນຂອງລູກຄ້າທີ່ຖືກລຶບ {1}; ກະລຸນາກູ້ຄືນລູກຄ້ານັ້ນແທນ",
  'The primary owner of a store cannot be deleted': 'ບໍ່ສາມາດລຶບເຈົ້າຂອງຮ້ານຫຼັກໄດ້',
  'The primary owner must stay an owner': 'ເຈົ້າຂອງຮ້ານຫຼັກຕ້ອງເປັນເຈົ້າຂອງຮ້ານສະເໝີ',
  'This owner has made sales and cannot be deleted': 'ບັນຊີນີ້ມີປະຫວັດການຂາຍ, ບໍ່ສາມາດລຶບໄດ້',
  'Daily customer limit reached for {0}': 'ຈຳນວນລູກຄ້າໃໝ່ຕໍ່ມື້ເຕັມແລ້ວ ({0})',

  // ---------------------------------------------------------------- catalog
  "Category '{0}' already exists in this store": "ໝວດໝູ່ '{0}' ມີຢູ່ໃນຮ້ານນີ້ແລ້ວ",
  'Category belongs to a different store': 'ໝວດໝູ່ນີ້ເປັນຂອງຮ້ານອື່ນ',
  "Barcode '{0}' already exists in this store": "ບາໂຄດ '{0}' ມີຢູ່ໃນຮ້ານນີ້ແລ້ວ",
  "Barcode '{0}' belongs to deleted product {1}; restore it instead":
    "ບາໂຄດ '{0}' ເປັນຂອງສິນຄ້າທີ່ຖືກລຶບ {1}; ກະລຸນາກູ້ຄືນສິນຄ້ານັ້ນແທນ",
  'Product belongs to a different store': 'ສິນຄ້ານີ້ເປັນຂອງຮ້ານອື່ນ',
  "Product '{0}' belongs to a different store": "ສິນຄ້າ '{0}' ເປັນຂອງຮ້ານອື່ນ",

  // ---------------------------------------------------------------- stock
  'This product already has an inventory in this store': 'ສິນຄ້ານີ້ມີສະຕັອກໃນຮ້ານນີ້ແລ້ວ',
  'No inventory for product {0} in store {1}; create one first':
    'ບໍ່ມີສະຕັອກຂອງສິນຄ້າ {0} ໃນຮ້ານ {1}; ກະລຸນາສ້າງສະຕັອກກ່ອນ',
  'Product {0} has no inventory in this store': 'ສິນຄ້າ {0} ບໍ່ມີສະຕັອກໃນຮ້ານນີ້',
  'reserved_qty cannot be greater than qty': 'ຈຳນວນຈອງ ບໍ່ສາມາດຫຼາຍກວ່າ ຈຳນວນໃນສະຕັອກ',
  'reserved_qty ({0}) cannot be greater than qty ({1})': 'ຈຳນວນຈອງ ({0}) ບໍ່ສາມາດຫຼາຍກວ່າ ຈຳນວນໃນສະຕັອກ ({1})',
  'Insufficient stock: available {0}, tried to remove {1}': 'ສິນຄ້າໃນສະຕັອກບໍ່ພໍ: ມີ {0}, ຕ້ອງການຕັດອອກ {1}',
  '{0} {1} is already resolved': '{0} {1} ຖືກແກ້ໄຂແລ້ວ',

  // ---------------------------------------------------------------- sales & payments
  'This store is blocked and cannot make sales': 'ຮ້ານນີ້ຖືກລະງັບ, ບໍ່ສາມາດຂາຍໄດ້',
  'The seller does not belong to this store': 'ຜູ້ຂາຍບໍ່ແມ່ນພະນັກງານຂອງຮ້ານນີ້',
  'The customer belongs to a different store': 'ລູກຄ້ານີ້ເປັນຂອງຮ້ານອື່ນ',
  'Discount ({0}) is larger than the subtotal ({1})': 'ສ່ວນຫຼຸດ ({0}) ຫຼາຍກວ່າຍອດລວມ ({1})',
  'Daily receipt limit reached for {0}': 'ຈຳນວນໃບບິນຕໍ່ມື້ເຕັມແລ້ວ ({0})',
  'Payment too large: sale total {0}, already paid/pending {1}, remaining {2}':
    'ຈຳນວນເງິນເກີນ: ຍອດຂາຍ {0}, ຊຳລະແລ້ວ/ລໍຖ້າ {1}, ຍັງເຫຼືອ {2}',
  "Cannot change payment status from '{0}' to '{1}'": "ບໍ່ສາມາດປ່ຽນສະຖານະການຊຳລະຈາກ '{0}' ເປັນ '{1}'",

  // ---------------------------------------------------------------- uploads
  'The file is empty': 'ໄຟລ໌ຫວ່າງເປົ່າ',
  'Only JPEG, PNG, WEBP or GIF images are allowed': 'ອະນຸຍາດສະເພາະຮູບ JPEG, PNG, WEBP ຫຼື GIF ເທົ່ານັ້ນ',
  'File is larger than {0} MB': 'ໄຟລ໌ໃຫຍ່ເກີນ {0} MB',
};

/**
 * Record names used as PARAMETERS ("{0} {1} not found" with {0} = "Product").
 * Translated too, so the whole sentence comes out in Lao.
 */
export const LO_NOUNS: Record<string, string> = {
  User: 'ຜູ້ໃຊ້',
  Store: 'ຮ້ານ',
  Owner: 'ບັນຊີຮ້ານ',
  Customer: 'ລູກຄ້າ',
  Category: 'ໝວດໝູ່',
  Product: 'ສິນຄ້າ',
  Inventory: 'ສະຕັອກ',
  'Stock move': 'ການເຄື່ອນໄຫວສະຕັອກ',
  Alert: 'ການແຈ້ງເຕືອນ',
  Sale: 'ການຂາຍ',
  Payment: 'ການຊຳລະເງິນ',
};
