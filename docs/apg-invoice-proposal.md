# APG Invoice - Bao cao de xuat chuc nang va lo trinh trien khai

Ngay lap: 26/03/2026

## 1. Ket luan nhanh

APG Invoice nen duoc xay dung nhu **trung tam quan ly ho so hoa don** nam duoi module `Finance`, khong phai mot phan mem phat hanh hoa don dien tu doc lap va cung khong thay the MISA meInvoice.

Vai tro de xuat cua APG Invoice:

- Quan ly hoa don dau vao tu nha cung cap xuat cho `HTX Van Tai O To Tan Phu` (`HTX Tan Phu`).
- Quan ly de nghi xuat hoa don dau ra tu `HTX Tan Phu` cho khach mua ve.
- Lien ket hoa don voi `Booking`, `PNR`, `Ticket`, `Customer`, `Supplier`, `Ledger`, `CashFlow`, `Reports`.
- Tao cac bo du lieu chuan de gui qua MISA meInvoice va doi soat sau khi MISA da phat hanh.

Khuyen nghi nghiep vu quan trong nhat:

1. Don vi hat nhan noi bo cua APG Invoice la **Invoice Line theo PNR**.
2. Mot hoa don dau ra co the co **1 hoac nhieu dong PNR**, tuy loai khach va ky xuat.
3. APG chi giu vai tro **quan tri, doi soat, xuat bo du lieu**; MISA van la he thong phat hanh hop le ve thue.

## 2. Vi tri trong he thong APG hien tai

Nen dat `Invoice` la mot muc con ben trong `Finance`, khong dua ra sidebar cap 1 moi.

Huong UI khuyen nghi:

- Sidebar giu nguyen `Finance`.
- Ben trong `Finance`, bo sung tab cap 1: `Invoice`.
- Ben trong `Invoice`, co tab cap 2:
  - `Tong quan`
  - `Hoa don dau ra`
  - `Hoa don dau vao`
  - `Quyet toan cong no`
  - `De nghi xuat hoa don`
  - `Cau hinh`

Ly do:

- Dung voi yeu cau "nam duoi muc Finance".
- Giam thay doi lon o sidebar hien tai.
- Tuan thu kien truc dang co cua trang [finance/page.tsx](/c:/Cá Nhân/apg-manager/apg-manager/apps/web/app/(authenticated)/finance/page.tsx).

## 3. Tai san he thong da co san de tan dung

Qua ra soat codebase, APG Manager da co san nhieu khoi rat phu hop cho Invoice:

- `Customer.type`, `companyName`, `companyTaxId` trong [schema.prisma](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/prisma/schema.prisma) de tach khach doanh nghiep va ca nhan.
- `Booking.pnr`, `bookingCode`, `tickets`, `payments` de tao dong hoa don theo PNR.
- `SupplierProfile` co `taxId`, `bankAccount`, `bankName` de quan ly NCC.
- `AccountsLedger` cho AR/AP de lien ket cong no voi hoa don.
- `CashFlowEntry` de doi chieu tinh trang thanh toan.
- `N8nService` trong [n8n.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/automation/n8n.service.ts) de di tiep voi OCR, import batch, thong bao.
- `ExcelExportService` trong [excel-export.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/sheet-sync/excel-export.service.ts) de tai su dung luong xuat file.
- `DocumentsService` trong [documents.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/documents/documents.service.ts) de tan dung kinh nghiem sinh chung tu, nhung khong nen dung endpoint "invoice" hien tai lam hoa don VAT chinh thuc.

Nhan xet quan trong:

- Endpoint `documents/invoice/:bookingId` hien tai chi la **sales invoice noi bo dang PDF**, chua phai ho so hoa don VAT chuan nghiep vu MISA.
- Can tach ro:
  - `Internal Sales Document` = chung tu noi bo/APG preview.
  - `Invoice Record` = ho so hoa don dau vao/dau ra de gui sang MISA va doi soat.

## 4. Bai hoc nen lay tu MISA meInvoice de ap dung cho APG

Tu nghien cuu tai lieu chinh thuc cua MISA meInvoice, co 4 nhom nang luc rat dang ap dung:

### 4.1. Quy trinh va trang thai

MISA nhan manh cac nang luc:

- Phe duyet phat hanh hoa don tren web/mobile.
- Theo doi tinh trang hoa don: da gui, khach da xem, da thanh toan.
- Theo doi thong ke hoa don: chua phat hanh, chua duyet, xoa bo.

Y nghia voi APG:

- APG Invoice can co workflow ro rang, khong chi la list tong hop.
- Can phan biet:
  - Trang thai nghiep vu noi bo.
  - Trang thai da gui sang MISA.
  - Trang thai phan hoi tu MISA/khach.

### 4.2. Xu ly hoa don dau vao tap trung

MISA co nhieu diem rat hop voi bai toan cua APG:

- Hien thi so tien da thanh toan mot phan va so tien con phai tra tren danh sach hoa don dau vao.
- Xuat bang ke hoa don dau vao theo tung dong hang hoa/dich vu.
- In, tai, xuat khau hang loat hoa don dau vao.
- Upload anh/PDF vao hoa don.
- Tu dong lay hoa don tu trang tra cuu cua nha cung cap.
- Nhap tay hoa don giay va PDF khong doc duoc.
- Theo doi ma nha cung cap de doi chieu va xuat file.
- Dan nhan, dinh kem tai lieu, ghi chu tung hoa don.

Y nghia voi APG:

- APG Invoice can co man hinh review hoa don dau vao manh.
- Can co attachment, note, tag, supplier code, batch export.
- Can co cot cong no con lai va lien ket AP ledger.

### 4.3. Batch operations va xuat du lieu

MISA cho thay huong lam viec dung cho ke toan:

- Xuat khau danh sach theo cot tuy chon.
- In/Tai/Xuat hang loat.
- Danh sach mac dinh toi uu theo 30 ngay de dam bao hieu nang.

Y nghia voi APG:

- APG Invoice nen uu tien nghiep vu list view, filter, batch action, export Excel.
- Day la huong dung nhu mot "trung tam dieu do hoa don", rat phu hop cach ke toan van hanh thuc te.

### 4.4. Mo rong tich hop

Tai lieu API cua MISA cho thay:

- Co quy trinh API 3 buoc: tao du lieu hoa don, ky so, phat hanh.
- Co API gui hoa don cho khach.
- Cau truc `InvoiceData` yeu cau ro buyer info, item detail, VAT, tong tien.

Y nghia voi APG:

- Giai doan dau khong can phat hanh truc tiep.
- Nhưng nen thiet ke data model cua APG Invoice ngay tu dau bám sat `InvoiceData` de sau nay:
  - gui file/import sang MISA de dang,
  - hoac tich hop API truc tiep neu doanh nghiep muon.

## 5. Dinh vi nghiep vu de xuat cho APG Invoice

### 5.1. Ban chat module

APG Invoice la module **quan tri hoa don - cong no - doi soat**, gom 2 huong:

- **Hoa don dau vao**: NCC xuat cho `HTX Tan Phu`.
- **Hoa don dau ra**: `HTX Tan Phu` xuat cho khach mua ve, nhung thao tac phat hanh thuc te thuc hien tren MISA.

### 5.2. Don vi du lieu co ban

Don vi co ban nen la:

- `1 PNR = 1 dong hang hoa/dich vu` trong hoa don.

Khuyen nghi van hanh:

- Khach ca nhan:
  - Mac dinh 1 booking/1 PNR/1 hoa don hoac 1 de nghi xuat.
- Khach doanh nghiep:
  - Cho phep gop nhieu PNR vao cung 1 de nghi xuat theo ky.
  - Moi dong van giu lien ket 1 PNR de doi soat, truy vet, va xuat bang ke.

Dieu nay vua dung yeu cau "moi 1 PNR la 1 mat hang", vua phu hop thuc te doanh nghiep can xuat tong hop theo thang.

### 5.3. Chu the xuat hoa don

Chu the ban mac dinh cua APG Invoice:

- Ten day du: `Hop tac xa Van tai O to Tan Phu`
- Ten ngan: `HTX Tan Phu`

Khuyen nghi luu trong `System Invoice Profile`, khong hard-code trong giao dien hay template, de sau nay co the sua:

- ten phap ly,
- ma so thue,
- dia chi,
- so tai khoan,
- ngan hang,
- hotline,
- email nhan/tra hoa don.

## 6. Cac chuc nang de xuat

## 6.1. Tong quan Invoice

Muc tieu:

- Cho ke toan nhin nhanh tinh hinh hoa don dau vao/dau ra.

Chi so de xuat:

- Tong gia tri hoa don dau vao theo ky.
- Tong gia tri de nghi xuat hoa don dau ra theo ky.
- So hoa don dang cho review OCR.
- So PNR da du dieu kien xuat hoa don nhung chua lap de nghi.
- So hoa don da xuat tren MISA nhung chua dong bo trang thai ve APG.
- Tong cong no lien quan invoice:
  - AP chua thanh toan.
  - AR chua thu.

## 6.2. Hoa don dau ra

Chuc nang cot loi:

- List danh sach hoa don/de nghi xuat.
- Tao draft tu booking da `ISSUED/COMPLETED/CHANGED`.
- Chon buyer theo `Customer`.
- Tu dong phan biet:
  - `INDIVIDUAL`
  - `CORPORATE`
- Tu dong tao invoice lines tu PNR va ticket data.
- Batch tao "de nghi xuat hoa don" cho nhieu PNR cung mot buyer doanh nghiep.
- Giu snapshot thong tin buyer tai thoi diem lap de nghi.
- Quan ly trang thai:
  - `ELIGIBLE`
  - `DRAFT`
  - `READY_FOR_EXPORT`
  - `EXPORTED_TO_MISA`
  - `ISSUED_IN_MISA`
  - `SENT_TO_CUSTOMER`
  - `VIEWED`
  - `PAID`
  - `PARTIAL_PAID`
  - `CANCELLED`
  - `ADJUSTED`
- Luu ref tu MISA sau khi phat hanh:
  - Mau so
  - Ky hieu
  - So hoa don
  - Ma tra cuu/TransactionID
  - Ngay phat hanh
  - Link tra cuu
  - PDF/XML tham chieu neu co

Quy tac nghiep vu:

- Khach ca nhan:
  - Neu khong yeu cau hoa don, giu trang thai `NOT_REQUESTED`.
  - Neu yeu cau hoa don, buoc buyer profile phai day du.
- Khach doanh nghiep:
  - Co the thiet lap `billing profile` mac dinh.
  - Cho phep gop nhieu PNR theo ky thang.

## 6.3. Hoa don dau vao

Chuc nang cot loi:

- List hoa don dau vao tu NCC xuat cho HTX Tan Phu.
- Tao thu cong hoa don dau vao.
- Import OCR tu anh/PDF qua n8n.
- Review ket qua OCR truoc khi ghi nhan chinh thuc.
- Tach dong hang theo PNR.
- Link hoa don dau vao voi:
  - `SupplierProfile`
  - `Booking`
  - `PNR`
  - `Ticket`
  - `AccountsLedger` huong `PAYABLE`
- Danh dau tinh trang:
  - `OCR_PENDING`
  - `NEED_REVIEW`
  - `VERIFIED`
  - `MATCHED`
  - `PARTIAL_PAID`
  - `PAID`
  - `INVALID`
  - `REJECTED`
- Ho tro:
  - tag,
  - note,
  - attachment,
  - lich su kiem tra,
  - phan hoi sai lech cho NCC.

Nguyen tac:

- Hoa don dau vao khong ton tai doc lap.
- No phai tro thanh "bang chung chi phi dau vao" cua booking/PNR trong APG.

## 6.4. Quyet toan cong no

Module nay sinh Excel giong anh mau ban gui:

- Loc theo khach hang, ky tu ngay - den ngay.
- Lay du lieu tu:
  - booking da xuat ve,
  - invoice lines dau ra,
  - thanh toan,
  - AR ledger.
- Mot dong = 1 PNR hoac 1 dong quy doi PNR theo quy tac xuat.

Cot de xuat:

- STT
- Ngay xuat ve
- Code ve/Booking code
- PNR
- Hanh trinh
- Ten hanh khach
- Currency
- So luong ve
- Gia ve moi khach
- Thue VAT
- Tong gia ve all-in
- Ghi chu

Chan footer:

- Thong tin chuyen khoan cua HTX Tan Phu
- Tong cong
- Nguoi lap / xac nhan

## 6.5. De nghi xuat hoa don

Day la file trung gian gui cho MISA meInvoice, khong phai hoa don da phat hanh.

Output de xuat:

- File Excel de gui bo phan ke toan/MISA.
- 1 sheet header:
  - buyer profile
  - payment method
  - ky xuat
  - customer code
  - loai buyer
- 1 sheet detail:
  - moi dong 1 PNR
  - item name
  - quantity
  - unit price
  - amount before VAT
  - VAT rate
  - VAT amount
  - total amount
  - booking code
  - PNR
  - route
  - passenger summary
- 1 sheet control:
  - tong so PNR
  - tong so tien
  - nguoi lap
  - ngay export
  - export batch id

## 6.6. Cau hinh va master data

Can them nhung master data sau:

- `Seller Profile` cua HTX Tan Phu.
- `Billing Profile` cho customer doanh nghiep.
- `Supplier Billing Profile` cho NCC dau vao.
- `Invoice Settings`:
  - quy tac gop PNR
  - ky xuat mac dinh
  - email nhan hoa don
  - quy tac VAT/service fee
  - numbering tham chieu noi bo

## 7. Mo hinh du lieu de xuat

Khuyen nghi them cac bang moi sau:

| Bang | Vai tro | Truong chinh de xuat |
|---|---|---|
| `InvoiceRecord` | Header hoa don/de nghi xuat | `id`, `direction`, `sourceType`, `status`, `invoiceDate`, `periodFrom`, `periodTo`, `buyerType`, `sellerProfileId`, `buyerSnapshot`, `supplierSnapshot`, `misaRef`, `totals`, `notes` |
| `InvoiceLineItem` | Dong nghiep vu theo PNR | `id`, `invoiceId`, `lineNo`, `pnr`, `bookingId`, `ticketIds`, `description`, `quantity`, `unitName`, `unitPrice`, `amountBeforeVat`, `vatRate`, `vatAmount`, `amount`, `serviceFee`, `passengerSnapshot`, `routeSnapshot` |
| `InvoiceAttachment` | Anh/PDF/XML va tai lieu lien quan | `id`, `invoiceId`, `type`, `fileName`, `mimeType`, `storagePath`, `source` |
| `InvoiceReviewLog` | Lich su review, OCR, doi soat | `id`, `invoiceId`, `action`, `fromStatus`, `toStatus`, `payload`, `createdBy` |
| `InvoiceExportBatch` | Dot xuat file | `id`, `type`, `filters`, `filePath`, `rowCount`, `createdBy`, `createdAt` |
| `InvoiceMisaDispatch` | Theo doi gui sang MISA | `id`, `invoiceId`, `dispatchType`, `status`, `payloadSnapshot`, `responseSnapshot`, `transactionId`, `sentAt` |
| `CustomerBillingProfile` | Ho so xuat hoa don cua buyer | `id`, `customerId`, `legalName`, `taxCode`, `address`, `email`, `receiverName`, `phone`, `bankAccount`, `bankName`, `isDefault` |
| `SupplierBillingProfile` | Ho so NCC dau vao | `id`, `supplierId`, `legalName`, `taxCode`, `address`, `email`, `bankAccount`, `bankName`, `supplierCode` |

Quan he nghiep vu:

- `InvoiceRecord (OUTGOING)` lien ket `Customer`, `Booking`, `AccountsLedger(RECEIVABLE)`.
- `InvoiceRecord (INCOMING)` lien ket `SupplierProfile`, `Booking`, `AccountsLedger(PAYABLE)`.
- `InvoiceLineItem` la diem neo trung tam de truy vet PNR.

## 8. Khoang trong du lieu hien tai can bo sung

He thong hien tai chua du thong tin hoa don cho buyer/seller:

### 8.1. Customer

Can bo sung them vao `Customer` hoac `CustomerBillingProfile`:

- legal buyer name
- billing address
- billing email
- buyer contact name
- buyer phone
- bank account
- bank name
- default payment method
- option co/khong lay hoa don

### 8.2. Supplier

`SupplierProfile` da co `taxId`, `bankAccount`, `bankName`, nhung nen bo sung:

- legal name neu khac `name`
- legal address
- invoice email
- supplier billing code

### 8.3. Booking

Can them metadata hoa don:

- co yeu cau hoa don hay khong
- loai buyer tai thoi diem lap booking
- billing profile override
- invoice note
- export eligibility status

## 9. Mapping du lieu tu cac anh mau ban gui

## 9.1. Hoa don dau vao tu NCC -> HTX Tan Phu

Can OCR/luu duoc cac truong:

- loai hoa don
- mau so
- ky hieu
- so hoa don
- ngay hoa don
- ma CQT/ma tra cuu
- seller legal name
- seller tax code
- seller address
- seller phone/email
- seller bank account/bank name
- buyer legal name
- buyer tax code
- buyer address
- payment method
- danh sach dong hang
  - mo ta dong hang
  - PNR
  - route
  - quantity
  - unit price
  - amount before VAT
  - VAT rate
  - VAT amount
  - amount
- cac khoan phi, thue, phi dich vu
- tong tien bang so
- tong tien bang chu
- ngay ky
- nguoi ky
- link tra cuu neu co

## 9.2. Hoa don dau ra HTX Tan Phu -> khach hang

Can luu:

- seller profile cua HTX Tan Phu
- buyer legal name
- buyer tax code
- buyer address
- payment method
- dong hang theo PNR
- so luong ve
- don gia
- thanh tien
- VAT
- tong thanh toan
- amount in words
- signed info
- ref MISA sau phat hanh

## 9.3. File Quyet toan cong no

Can map tu du lieu booking/invoice:

- date range
- customer company info
- danh sach dong PNR
- tong hop subtotal
- thong tin thanh toan cua HTX Tan Phu

## 10. Luong hoat dong de xuat

### 10.1. Luong hoa don dau ra

1. Booking dat trang thai `ISSUED` hoac `COMPLETED`.
2. He thong kiem tra dieu kien xuat hoa don:
   - co customer,
   - co PNR/tickets,
   - co tong tien,
   - chua nam trong invoice da issue.
3. Tao `Invoice Candidate`.
4. Ke toan chon:
   - xuat rieng,
   - gop theo doanh nghiep/ky.
5. He thong tao `InvoiceRecord` + `InvoiceLineItem`.
6. APG xuat `De nghi xuat hoa don` de gui MISA.
7. Sau khi MISA phat hanh, cap nhat lai:
   - so hoa don,
   - ky hieu,
   - ngay issue,
   - lookup url,
   - PDF/XML ref,
   - status send/view/pay.

### 10.2. Luong hoa don dau vao

1. Ke toan upload anh/PDF vao APG Invoice.
2. APG goi n8n OCR.
3. OCR tra ve header + line items.
4. Man review cho phep sua tay neu can.
5. He thong match supplier theo MST/ten.
6. He thong match line theo:
   - PNR trong description,
   - booking code,
   - route,
   - amount.
7. Tao `InvoiceRecord(INCOMING)`.
8. Lien ket voi `AccountsLedger(PAYABLE)` de theo doi da thanh toan/chua.
9. Batch export sang Excel neu can doi soat.

### 10.3. Luong quyet toan cong no

1. Chon customer + ky.
2. He thong lay tat ca line item/booking lien quan.
3. Tong hop theo PNR.
4. Xuat file Excel theo template.
5. Danh dau export batch.

### 10.4. Luong de nghi xuat hoa don

1. Chon customer doanh nghiep hoac nhieu PNR cua khach ca nhan.
2. Freeze snapshot buyer/seller.
3. Kiem tra thieu MST/dia chi/email.
4. Xuat file Excel chuan de gui MISA.
5. Sau khi MISA issue xong, nhap lai ref hoac sync tu dong.

## 11. Tinh nang nen co ngay tu MVP

MVP khuyen nghi chua lam qua rong, nhung phai dung trong tam:

- Finance > Invoice tab.
- Danh sach hoa don dau vao.
- Danh sach hoa don dau ra/de nghi xuat.
- Tao hoa don dau vao thu cong.
- Tao de nghi xuat hoa don dau ra tu booking/PNR.
- Detail screen co attachment, note, tag.
- Filter theo:
  - date range
  - direction
  - status
  - customer
  - supplier
  - PNR
  - booking code
  - tax code
- Export:
  - Quyet toan cong no
  - De nghi xuat hoa don
- Ref MISA de cap nhat thu cong sau khi phat hanh.

## 12. Tinh nang de cho san va hoan thien sau

Dung nhu yeu cau cua ban, 2 tinh nang nen dat san o design ngay tu dau nhung co the hoan thien sau:

### 12.1. Nhap hoa don dau vao bang n8n OCR

Can duoc thiet ke ngay trong MVP:

- nut `Import hoa don`
- object `InvoiceImportBatch`
- status `OCR_PENDING`, `NEED_REVIEW`
- attachment storage

Co the hoan thien o phase tiep theo:

- OCR doc file anh/PDF
- auto split dong PNR
- auto match NCC va booking

### 12.2. Xuat file Excel

Can dat san:

- nut `Xuat Quyet toan cong no`
- nut `Xuat De nghi xuat hoa don`
- object `InvoiceExportBatch`

Co the hoan thien o phase sau:

- format template giong mau thuc te
- batch export
- luu lich su xuat file

## 13. Phan quyen de xuat

| Role | Quyen de xuat |
|---|---|
| `ADMIN` | Toan quyen, cau hinh seller profile, mapping MISA |
| `ACCOUNTANT` | Tao/sua/review/export invoice, cap nhat ref MISA |
| `MANAGER` | Xem, phe duyet de nghi xuat, theo doi tong quan |
| `SALES` | Xem trang thai invoice cua booking, de xuat yeu cau hoa don |

Phe duyet toi thieu nen co:

- `Draft -> Ready for export`
- `Ready for export -> Exported to MISA`

## 14. Ky thuat va tich hop

### 14.1. Huong trien khai duoc khuyen nghi

Giai doan 1:

- APG tao file/bo du lieu gui MISA.
- MISA la noi issue hoa don.
- APG luu ref issue ve doi soat.

Giai doan 2 tuy chon:

- Tich hop API MISA de day `InvoiceData` len truc tiep.
- Neu di huong nay, APG phai xu ly them luong tao, ky, phat hanh, gui email.

### 14.2. Nguyen tac ky thuat quan trong

- Khong cho phep 1 PNR bi xuat trung trong 2 hoa don dau ra chua huy/dieu chinh.
- Luu snapshot buyer/seller/line item tai thoi diem export.
- Khong suy dien lai du lieu hoa don tu booking sau khi da export.
- Moi import/export phai co audit trail.
- Moi OCR batch phai co review step, khong ghi thang vao so cai.

## 15. Rui ro va diem can canh bao

1. Data billing cua customer hien tai chua du.
2. Nha cung cap co the xuat 1 hoa don gom nhieu PNR va cach ghi mo ta khong dong nhat.
3. Neu giu ten endpoint `documents/invoice` hien tai, nguoi dung de nham voi hoa don VAT chinh thuc.
4. Neu khong luu snapshot line item, sau nay booking doi/hoan se lam sai lich su hoa don.
5. OCR hoa don bay/noi dia/quoc te co the khong dong nhat mau, can co review bat buoc.

## 16. Lo trinh trien khai khuyen nghi

Neu bat dau sau khi duyet spec nay, lo trinh hop ly la 4 giai doan trong khoang 4-6 tuan:

### Giai doan 0 - Chot spec va field mapping

Thoi luong: 2-3 ngay

Dau ra:

- Chot data model.
- Chot template `Quyet toan cong no`.
- Chot template `De nghi xuat hoa don`.
- Chot danh muc field buyer/seller/supplier.

### Giai doan 1 - Nen tang Invoice

Thoi luong: 1-1.5 tuan

Pham vi:

- DB schema Invoice.
- API CRUD co ban.
- Finance > Invoice UI.
- Danh sach dau vao/dau ra.
- Tao draft dau ra tu booking/PNR.
- Tao dau vao thu cong.
- Note/tag/attachment meta.

### Giai doan 2 - Lien ket nghiep vu va cong no

Thoi luong: 1-1.5 tuan

Pham vi:

- Link voi AR/AP ledger.
- Trang thai payment cho invoice.
- Match supplier/customer/booking.
- Quyet toan cong no version 1.
- Validation trung PNR.

### Giai doan 3 - OCR va Export center

Thoi luong: 1-1.5 tuan

Pham vi:

- n8n OCR import image/PDF.
- Review queue.
- Xuat `Quyet toan cong no`.
- Xuat `De nghi xuat hoa don`.
- Lich su export batch.

### Giai doan 4 - Dong bo MISA nang cao

Thoi luong: tuy chon 1-2 tuan

Pham vi:

- Cap nhat ref issue tu dong.
- Import ket qua issue tu MISA.
- Can nhac API direct sync.

Khuyen nghi uu tien:

- Lam den het Giai doan 3 la da dung nhu cau hien tai.
- Giai doan 4 chi lam khi quy trinh noi bo da on dinh.

## 17. De xuat chot de di implement

Toi khuyen nghi chot 7 diem sau truoc khi bat dau code:

1. `1 PNR = 1 invoice line`.
2. Khach doanh nghiep duoc gop nhieu PNR tren 1 de nghi xuat.
3. APG khong phat hanh truc tiep, MISA la he thong issue chinh thuc.
4. Invoice nam trong `Finance > Invoice`.
5. Hoa don dau vao phai lien ket duoc toi supplier + PNR + AP ledger.
6. Export `Quyet toan cong no` va `De nghi xuat hoa don` la deliverable phase dau.
7. OCR nhap hoa don dau vao duoc dat san o data model/UI ngay tu dau, hoan thien sau.

## 18. Nguon tham khao chinh

Nguon chinh thuc cua MISA meInvoice da doi chieu ngay 26/03/2026:

- MISA meInvoice feature page: https://www.meinvoice.vn/tinh-nang-hoa-don-dien-tu/
- MISA meInvoice homepage: https://www.meinvoice.vn/
- MISA meInvoice input-processing changelog/help: https://helpv4.meinvoice.vn/kb/tinh-nang-moi-inbots/
- MISA API - tao, ky va phat hanh hoa don: https://doc.meinvoice.vn/api/Document/InvoicePublishing.html
- MISA API - gui hoa don: https://doc.meinvoice.vn/api/Document/SendInvoice.html
- MISA InvoiceData schema: https://doc.meinvoice.vn/itg/Doc/Info/InvoiceData.html

Can cu local codebase APG:

- [schema.prisma](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/prisma/schema.prisma)
- [finance/page.tsx](/c:/Cá Nhân/apg-manager/apg-manager/apps/web/app/(authenticated)/finance/page.tsx)
- [ledger.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/finance/ledger.service.ts)
- [bookings.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/bookings/bookings.service.ts)
- [n8n.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/automation/n8n.service.ts)
- [documents.service.ts](/c:/Cá Nhân/apg-manager/apg-manager/apps/api/src/documents/documents.service.ts)
