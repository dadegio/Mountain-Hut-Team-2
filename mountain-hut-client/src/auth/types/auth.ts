export const USER_TYPES = ["HIKER", "EMPLOYEE", "MANAGER"] as const;
export type UserType = (typeof USER_TYPES)[number];

export interface User {
  id: number;
  email: string;
  name: string;
  surname: string;
  phoneNumber: number | string;
  type: UserType;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  surname: string;
  phoneNumber: string;
  type: "HIKER";
}
