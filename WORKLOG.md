# Work Log

ไฟล์นี้ใช้เป็นบันทึกงานต่อเนื่องของโปรเจค `kppost-ui` เพื่อให้เปิด repo แล้วเห็นทันทีว่าเราเปลี่ยนอะไรไปแล้วบ้าง และอะไรคือทิศทางหลักของโปรเจค

## เป้าหมายหลัก

- ทำ `kppost-ui` ให้เป็น desktop app สำหรับ macOS และ Windows
- ให้ผู้ใช้เปิดใช้งานได้โดยไม่ต้องติดตั้ง dependency เอง
- รักษา workflow ให้ตรงกับ `kppwppost` CLI เดิม
- รองรับการติดตั้งและอัปเดต CLI จาก GitHub ภายในแอพ
- ช่วงนี้ยังเน้นโหมดทดสอบจริงและ debug ง่ายก่อน native packaging

## สิ่งที่ทำไปแล้ว

### Backend / Runtime

- เพิ่มระบบจัดการ path runtime ผ่าน environment เช่น `KPPPOST_UI_DATA_DIR`
- แยก logic path/runtime ออกไปไว้ใน `backend/app_paths.py`
- เพิ่มตัวจัดการ CLI install/update/status ใน `backend/cli_manager.py`
- ปรับ `backend/main.py` ให้รองรับ:
  - app data แยกจาก repo
  - local test launcher
  - log file สำหรับ backend
  - route สำหรับ `cli/status`, `cli/install`, `cli/update`
  - การเสิร์ฟ frontend build จาก `frontend/dist`

### Launcher / Testing

- เพิ่ม launcher สำหรับเปิดทดสอบบนเครื่องจริง:
  - `scripts/run-local-test.sh`
  - `scripts/run-local-test.ps1`
- แยก runtime ออกจาก repo ไปไว้ใน `.local-runtime/`
- เพิ่ม `TESTING.md` อธิบายวิธีเปิดทดสอบ, path log, data, workspace และ flow ที่ควรลอง

### Frontend Structure

- แยก workflow components ออกจากไฟล์รวมเดิม
- เพิ่มไฟล์ย่อยใน `frontend/src/components/workflow/`
  - `BatchPreviewView.tsx`
  - `BatchReviewView.tsx`
  - `RawSourceEditor.tsx`
  - `SortableImage.tsx`
  - `WorkflowButton.tsx`
  - `helpers.ts`
- ย้าย `API_BASE` ไปไว้ที่ `frontend/src/lib/api.ts`
- ย้าย API calls หลักไปไว้ที่ `frontend/src/lib/appApi.ts`
- แยก modal หลักไปไว้ที่ `frontend/src/components/AppModals.tsx`

### UI / Behavior

- ปรับ Raw Source Editor ให้รูปเป็น thumbnail ขนาดเล็กแบบแน่นขึ้น
- แยก variant ของ `SortableImage` เป็น `default` และ `compact`
- คง behavior เดิมของ prepared images ใน `BatchPreviewView`

### Cleanup รอบล่าสุด

- เพิ่ม type กลางไว้ที่ `frontend/src/types/app.ts`
- แยก hook สำหรับ workspace data:
  - `frontend/src/hooks/useWorkspaceData.ts`
- แยก hook สำหรับ CLI status/polling:
  - `frontend/src/hooks/useCliStatus.ts`
- แยก settings subcomponents:
  - `frontend/src/components/settings/CliManagementPanel.tsx`
  - `frontend/src/components/settings/WordPressSettings.tsx`
- แยก sidebar ย่อยเพิ่ม:
  - `frontend/src/components/sidebar/SidebarBatchSection.tsx`
  - `frontend/src/components/sidebar/SidebarFooter.tsx`
- แก้ raw image reorder ให้มี optimistic update ในหน้า editor
- ล็อกลำดับรูปจาก backend ให้ sort ตามชื่อไฟล์ก่อนส่งกลับ UI
- ปรับ raw thumbnails ให้เป็นกรอบสี่เหลี่ยมจัตุรัสและใช้ `object-contain` เพื่อเห็นภาพครบขึ้น

### Raw Source Workspace Layout

- ย้ายปุ่ม `New Post` ออกจาก sidebar ไปไว้ที่หน้าทำงาน raw source โดยตรง
- ปรับหน้า raw source ให้เป็น split layout:
  - ฝั่งซ้ายเป็นรายการ subfolder ที่แสดงตลอด
  - ฝั่งขวาแสดง editor เมื่อเลือก subfolder เท่านั้น
- เพิ่ม component สำหรับวาง layout raw source workspace:
  - `frontend/src/components/workflow/RawSourceWorkspaceView.tsx`
- ปรับ `RawSourceBrowser` ให้ใช้ได้ทั้งแบบมี header และแบบฝังเป็น sidebar list
- แยก state ของ raw source root กับ item ที่เปิด editor ออกจากกันใน `frontend/src/App.tsx`
- แก้ reorder ของรูป raw ให้ส่ง workspace-relative path ที่ถูกต้องไป backend

### Repo Setup

- init git repository ในโฟลเดอร์โปรเจกต์แล้ว
- เปลี่ยน default branch เป็น `main`
- อัปเดต `.gitignore` ให้ครอบคลุม runtime, build output, cache และไฟล์ชั่วคราวที่เกี่ยวข้อง

## สิ่งที่ยังควรทำต่อ

- แยก state/action ใน `frontend/src/App.tsx` ออกอีกถ้ายังโตเกินไป
- ลดการใช้ `any` ใน component ที่เก่ากว่า
- เพิ่ม smoke test ที่รันง่ายขึ้นสำหรับ backend routes หลัก
- เตรียม flow native packaging หลังจากทดสอบบนเครื่องจริงนิ่งแล้ว

## Source Of Truth

- CLI behavior: `backend/cli/kppwppost/`
- Desktop/backend bridge: `backend/main.py`
- Frontend app: `frontend/src/`
- การทดสอบบนเครื่องจริง: `TESTING.md`
- ภาพรวมโครงสร้างโปรเจค: `PROJECT_MAP.md`
