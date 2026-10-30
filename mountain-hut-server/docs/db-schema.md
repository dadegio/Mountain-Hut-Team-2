```txt
user(*id*, email, name, surname, phone_number, type)
time_slot(*id*, date, from, to)            unique(date, from, to)
table(*id*, code, seats)                   unique(code)

table_availability(*id*, table_id, slot_id) unique(slot_id, table_id)
reservation(*reservation_id*, hiker_id, slot_id, table_id, created_at, party_size, status)
```
