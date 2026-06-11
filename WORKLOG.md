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

### Latest Changes

- แก้ WordPress config ให้ใช้งานตรงกับ CLI runtime จริง:
  - ใช้ `workspace/.env` เป็น source หลัก
  - fallback อ่านจาก legacy CLI `.env`
  - inject env เข้า subprocess ตอนรัน CLI เพื่อกันปัญหา `preflight/post` หา credentials ไม่เจอ
- เพิ่ม backend tests สำหรับ WP config route และ CLI env injection:
  - `backend/tests/test_wp_config_routes.py`
  - `backend/tests/test_cli_manager.py`
- เพิ่ม workflow status สำหรับ batch ใน backend:
  - expose `has_batch_json`, `latest_generate_output`, `latest_post_report`
  - ใช้เป็น source of truth สำหรับปุ่ม `Generate`, `Preflight`, `Post`
- ปรับหน้า batch preview ให้มีสถานะ command รายปุ่ม:
  - `Generate` แสดงสำเร็จเมื่อ command ผ่าน
  - `Preflight` parse summary จาก stdout + JSON ที่ CLI คืนกลับ
  - `Post` แสดง summary และ report path
  - disable `Preflight`/`Post` จนกว่าจะมี `batch.json`
- เพิ่ม flow `New Post` สำหรับ raw source:
  - สร้างโฟลเดอร์ชื่อ `yymmddhhmm-department_code`
  - สร้างไฟล์ `.txt` ชื่อเดียวกับโฟลเดอร์
  - เปิด folder ใหม่ใน editor ทันทีหลังสร้างสำเร็จ
- ย้าย raw folders list มาอยู่ใน block `Step 0 • Raws` ใต้ช่อง add folder
- ปรับตำแหน่งปุ่ม `Prepare` ใน raw source workspace ให้อยู่ตาม flow ที่ใช้งานจริงและใกล้กับ `New Post`
- ย้าย `departments.json` ออกจาก raw workspace ไปไว้หน้า `Settings`
- เปลี่ยนแนวคิด `departments.json` ให้เป็นไฟล์เดียวระดับทั้ง workspace:
  - ใช้ `Raws/.kppost/departments.json`
  - `New Post` และ `Prepare` บังคับให้ตั้งค่าไฟล์นี้ก่อน
  - หน้า `Settings` เป็นจุดเดียวสำหรับแก้ workspace departments
- เพิ่ม migration ตอนเปลี่ยน workspace root:
  - copy `Raws/.kppost/departments.json` จาก workspace เดิมไป workspace ใหม่ถ้าปลายทางยังไม่มี
  - copy `workspace/.env` จาก workspace เดิมไป workspace ใหม่ถ้าปลายทางยังไม่มี
  - ไม่ overwrite ของปลายทางที่มีอยู่แล้ว
- เพิ่ม backend tests สำหรับ:
  - raw post creation
  - batch workflow metadata
  - migration ของ workspace departments และ workspace `.env`

- ปรับหน้า `Settings` ให้มีปุ่ม `Back to workspace` และออกจากหน้า settings อัตโนมัติเมื่อผู้ใช้เลือก item จาก sidebar
- แก้ flow เปลี่ยน `workspace folder` ให้ refresh workspace ทันทีทั้งกรณี `Browse` และกรณีพิมพ์ path เองแล้วกด save
- ล้าง selection/state ที่ยังอ้างถึง workspace เดิมหลังสลับ root path เพื่อไม่ให้หน้า editor ค้างกับ path เก่า
- เพิ่ม migration ของ reusable `departments` template/cache ตอนเปลี่ยน workspace:
  - copy เฉพาะ cache ที่อ้างจาก `prepare-report.json`
  - ไม่แตะ batch เก่า
  - ไม่ overwrite ไฟล์ปลายทางที่มีอยู่แล้ว
  - ignore path นอก workspace
- เพิ่ม backend tests สำหรับ departments template migration และ guard path ที่ไม่ปลอดภัย
- ปรับ `CLI Management` ให้ปุ่ม `Update CLI` และ `Install CLI` มี feedback ชัดขึ้น:
  - แสดงสถานะเริ่มทำงานทันที
  - กันการกดซ้ำระหว่าง `installing/updating`
  - แสดงข้อความสถานะระหว่างรัน
  - แจ้งผลเมื่อเสร็จหรือเมื่อเกิด error
- แก้ `Canva import` ให้หน้า batch preview refresh หลัง import สำเร็จ เพื่อให้เห็นข้อมูลใหม่ทันที
- ปรับ refresh หลัง `Canva import` ไม่ให้รีเซ็ตการเลือกโพสต์เองระหว่างดู batch เพื่อไม่ให้หน้าดูเหมือนโดน reorder

## สิ่งที่ยังควรทำต่อ

- แยก state/action ใน `frontend/src/App.tsx` ออกอีกถ้ายังโตเกินไป
- ลดการใช้ `any` ใน component ที่เก่ากว่า
- เพิ่ม smoke test ที่รันง่ายขึ้นสำหรับ backend routes หลัก
- เพิ่มข้อความ feedback หลังเปลี่ยน workspace ว่า migrate `.env` และ workspace departments สำเร็จหรือถูก skip
- พิจารณาทำ summary/status card ในหน้า Settings สำหรับ `workspace .env` และ `Raws/.kppost/departments.json`
- เตรียม flow native packaging หลังจากทดสอบบนเครื่องจริงนิ่งแล้ว

## Process Notes

- ย้ำกติกา final response: ทุกครั้งที่จบงานต้องมีหัวข้อ `สิ่งที่ทำไปแล้ว` และ `สิ่งที่ควรทำต่อ` ให้ชัดเจน
- หากไม่มีงานค้าง ต้องระบุตรง ๆ ว่าไม่มีงานค้างที่จำเป็น ห้ามสรุปแค่สิ่งที่แก้แล้วอย่างเดียว

## Source Of Truth

- CLI behavior: `backend/cli/kppwppost/`
- Desktop/backend bridge: `backend/main.py`
- Frontend app: `frontend/src/`
- การทดสอบบนเครื่องจริง: `TESTING.md`
- ภาพรวมโครงสร้างโปรเจค: `PROJECT_MAP.md`
