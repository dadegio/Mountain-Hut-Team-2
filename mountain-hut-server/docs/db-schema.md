```txt
user(*id*, email, name, surname, phone_number, type)
time_slot(*id*, from, to)
table(*id*, code, seats)

table_availability(*id*, table_id, slot_id, date)
reservation(*reservation_id*, hiker_id, slot_id, table_id, schedule_date, created_at, party_size, status)
```
