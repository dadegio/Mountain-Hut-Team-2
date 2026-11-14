POST {{base_url}}/api/v1/auth/register
{
    "email": "tizio51@mail.com",
    "password": "pwdTest50",
    "name": "Tizio",
    "surname": "Caio"
}
HTTP 201

POST {{base_url}}/api/v1/auth/login
{
    "email": "tizio51@mail.com",
    "password": "WRONG"
}
HTTP 401

GET {{base_url}}/api/v1/auth/me
HTTP 401
