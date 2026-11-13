POST {{base_url}}/api/v1/auth/register
{
    "email": "tizio50@mail.com",
    "password": "pwdTest50",
    "name": "Tizio",
    "surname": "Caio"
}
HTTP 201

POST {{base_url}}/api/v1/auth/login
{
    "email": "tizio50@mail.com",
    "password": "pwdTest50"
}
HTTP 200

GET {{base_url}}/api/v1/auth/me
HTTP 200

POST {{base_url}}/api/v1/auth/logout
HTTP 200
