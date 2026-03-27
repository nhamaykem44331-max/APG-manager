# APG Booking Import Guide

File mau:
- `templates/APG_Booking_Import_Template.csv`

Dung file nay khi:
- Tao moi booking bang tay de import vao APG Manager.
- Chinh sua nhanh booking bang Google Sheets/Excel roi import nguoc vao he thong.

Cot nen dien toi thieu cho booking moi:
- `Mã booking` hoac `PNR`
- `Tên đại diện`
- `Điện thoại`
- `Tên khách hàng`
- `Giá vốn`
- `REV FIT`
- `Trạng thái booking`
- `Trạng thái thanh toán`

Cot rat nen dien them:
- `Mã KH`
- `Phụ trách`
- `Nhà cung cấp`
- `Loại khách hàng`
- `Phương thức thanh toán`
- `Nguồn booking`
- `Khởi hành đầu tiên`
- `Điểm đến cuối`
- `Số hiệu chuyến bay`
- `Hành khách`

Cot he thong, co the de trong neu ban nhap moi bang tay:
- `SYNC_KEY`
- `BOOKING_ID`
- `CUSTOMER_ID`
- `STAFF_ID`
- `SUPPLIER_ID`
- `GDS_BOOKING_ID`
- `BOOKING_JSON`
- `TEMPLATE_VERSION`

Luu y quan trong:
- Neu ban muon update lai booking da co san trong APG va giu du 100% lien ket, tot nhat hay `Push/Export` tu APG truoc, sau do sua tren file do roi moi import lai.
- Neu ban tu tao moi mot dong thu cong, APG van import duoc cac thong tin booking chinh. Tuy nhien cac thong tin cau truc sau nhu nhieu chang bay, nhieu hanh khach, hoac snapshot chi tiet se day du nhat khi dong du lieu goc duoc xuat ra tu APG.
- `BOOKING_JSON` la cot snapshot may doc. Khong can nhap tay neu ban dang tao booking moi bang tay.

Mau dien nhanh 1 dong:
- `Mã booking`: `APG-260325-999`
- `PNR`: `FXGAJZ`
- `Tên đại diện`: `NGUYEN CONG PHONG`
- `Điện thoại`: `0978569874`
- `Tên khách hàng`: `NGUYEN CONG PHONG`
- `Giá vốn`: `2800000`
- `REV FIT`: `3000000`
- `Trạng thái booking`: `ISSUED`
- `Trạng thái thanh toán`: `PAID`
- `Phương thức thanh toán`: `BANK_TRANSFER`
- `Nguồn booking`: `PHONE`
- `Phụ trách`: `Nguyen Duc Anh`

Gia tri hop le khuyen dung:
- `Trạng thái booking`: `NEW`, `PROCESSING`, `QUOTED`, `PENDING_PAYMENT`, `ISSUED`, `COMPLETED`, `CHANGED`, `REFUNDED`, `CANCELLED`
- `Trạng thái thanh toán`: `UNPAID`, `PARTIAL`, `PAID`, `REFUNDED`
- `Phương thức thanh toán`: `CASH`, `BANK_TRANSFER`, `CREDIT_CARD`, `MOMO`, `VNPAY`, `DEBT`
- `Nguồn booking`: `PHONE`, `ZALO`, `MESSENGER`, `WEBSITE`, `WALK_IN`, `REFERRAL`
- `Loại khách hàng`: `INDIVIDUAL`, `CORPORATE`
