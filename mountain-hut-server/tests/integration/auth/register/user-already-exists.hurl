POST {{base_url}}/api/v1/auth/register
{
    "email": "tizio1@mail.com",
    "password": "pwdTest1",
    "name": "Tizio",
    "surname": "Caio",
    "phoneNumber": "+031415926535"
}
HTTP 201

POST {{base_url}}/api/v1/auth/register
{
    "email": "tizio1@mail.com",
    "password": "pwdTest1",
    "name": "Tizio",
    "surname": "Caio",
    "phoneNumber": "+031415926535"
}
HTTP 409
