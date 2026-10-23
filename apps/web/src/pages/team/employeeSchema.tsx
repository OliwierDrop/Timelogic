import { z } from "zod";

export const employeeSchema = z.object({
  first_name: z.string().min(1, "Podaj imię"),
  last_name: z.string().min(1, "Podaj nazwisko"),
  email: z.string().email("Podaj poprawny e-mail"),
  phone: z.string().optional(),
  position_id: z.string().optional(),
  supervisor_id: z.string().optional(),
  role: z.enum(["employee", "manager", "hr", "admin"], {
    message: "Wybierz rolę",
  }),
});

export type EmployeeValues = z.infer<typeof employeeSchema>;

export type AuthUser = { id: string; email: string; roles?: string[] };

export const CREATE_DEFAULTS: EmployeeValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position_id: "",
  supervisor_id: "",
  role: "employee",
};

export function requiredLabel(text: string) {
  return (
    <>
      {text} <span className="req-mark" aria-hidden>*</span>
    </>
  );
}
