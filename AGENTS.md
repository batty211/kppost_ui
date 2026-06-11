# AGENTS.md

ไฟล์นี้กำหนดกฎการทำงานสำหรับ Coding Agent ที่ทำงานใน repository นี้
และมีผลกับทั้ง frontend, backend และเครื่องมือประกอบทั้งหมด

## Completion Summary

ทุกครั้งที่จบงานหรือส่งคำตอบสุดท้าย Agent ต้องสรุปให้ผู้ใช้ทราบอย่างชัดเจน:

1. **สิ่งที่แก้ไปแล้ว**
   - ระบุ behavior, UI, API, tests หรือไฟล์สำคัญที่เปลี่ยน
   - ระบุผลการตรวจสอบ เช่น build, tests หรือข้อจำกัดที่ยังทดสอบไม่ได้

2. **สิ่งที่ควรทำต่อ**
   - ระบุงานถัดไปที่มีประโยชน์หรือความเสี่ยงที่ยังเหลืออยู่
   - หากไม่มีงานที่จำเป็นต้องทำต่อ ให้ระบุว่าไม่มีงานค้างที่จำเป็น

รูปแบบหัวข้อในคำตอบสุดท้ายต้องมีถ้อยคำสองส่วนนี้อย่างชัดเจน:
- `สิ่งที่ทำไปแล้ว`
- `สิ่งที่ควรทำต่อ`

ห้ามจบคำตอบด้วยเพียงคำว่าเสร็จแล้ว หรือรายงานเฉพาะสิ่งที่แก้โดยไม่กล่าวถึง
ขั้นตอนถัดไป

## Python Testing

- ถ้าต้องรันเทสต์ Python ให้ใช้ Miniconda ที่มีอยู่บนเครื่องนี้ก่อนเสมอ
- ไม่ต้องเสียเวลาหา Python environment อื่น ถ้า Miniconda ใช้งานได้อยู่แล้ว
- ตัวอย่างคำสั่งที่ควรใช้:
  - `conda run -n base python -m unittest discover -s backend/tests -p 'test_*.py'`
  - ถ้ามี environment สำหรับโปรเจกต์อยู่แล้ว ให้ใช้ `conda run -n <env-name> ...` แทน

## Frontend Testing

- ถ้าต้องตรวจ frontend ให้ใช้ `npm` ตามที่ repo นี้กำหนดไว้
- ตัวอย่างคำสั่งที่ควรใช้:
  - `cd frontend && npm run build`
  - `cd frontend && npm run lint`

## Full Project Check

- ถ้าต้องตรวจทั้ง backend และ frontend ให้รัน backend tests ก่อน แล้วค่อยตรวจ frontend
- ตัวอย่างลำดับคำสั่ง:
  - `conda run -n base python -m unittest discover -s backend/tests -p 'test_*.py'`
  - `cd frontend && npm run build`
  - `cd frontend && npm run lint`

## Targeted Checks

- ถ้าแก้เฉพาะจุด ให้รันเทสต์เฉพาะส่วนที่เกี่ยวข้องก่อนเสมอ
- ตัวอย่าง:
  - แก้ backend เฉพาะไฟล์ใดไฟล์หนึ่ง ให้รัน `conda run -n base python -m unittest backend.tests.test_<name>`
  - แก้ frontend เฉพาะส่วน ให้รัน `cd frontend && npm run build` ก่อน แล้วค่อย `cd frontend && npm run lint` ถ้ากระทบโค้ด logic หรือ type
- ถ้าการแก้เป็นเรื่อง routing, API, หรือ file I/O ให้มีอย่างน้อยหนึ่งเทสต์ที่แตะพฤติกรรมจริงของส่วนที่แก้
