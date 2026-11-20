// GET /api/v1/meals?date=YYYY-MM-DD (MH-133)
export type Course = "APPETIZER" | "MAIN" | "SIDE" | "DESSERT" | "BEVERAGE";

export interface MealAllergen {
  id: number;
  name: string;
}

export interface MealDish {
  id: number;
  name: string;
  description: string | null;
  course: Course;
  allergens: MealAllergen[];
}

export interface MealMenu {
  id: number;
  name: string;
  type: "TEMPLATE" | "MODIFIED" | "CANCELED";
  allergens: MealAllergen[]; // all allergens of its dishes
  dishes: MealDish[];
}

export interface MealTime {
  slotId: number;
  date: string;
  from: string;
  to: string;
  menus: MealMenu[];
}