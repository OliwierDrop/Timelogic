import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import {
  ApiError,
  post,
  type Employee,
  type Position,
  type Tag,
} from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import { DEFAULT_TAG_COLOR } from "../../tags";
import {
  CREATE_DEFAULTS,
  employeeSchema,
  requiredLabel,
  type EmployeeValues,
} from "./employeeSchema";
import { ROLE_OPTIONS } from "./roles";

export function CreateEmployeeModal({
  isAdmin,
  positions,
  tags,
  peers,
  onClose,
  onAddPosition,
  onManagePositions,
  onAddTag,
  onManageTags,
  selectTagId,
}: {
  isAdmin: boolean;
  positions: Position[];
  tags: Tag[];
  peers: Employee[];
  onClose: () => void;
  onAddPosition: () => void;
  onManagePositions: () => void;
  onAddTag: () => void;
  onManageTags: () => void;
  selectTagId: string | null;
}) {
  const client = useQueryClient();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: CREATE_DEFAULTS,
  });
  const createRole = watch("role") || "employee";
  const createRoleHint =
    ROLE_OPTIONS.find((r) => r.code === createRole)?.hint || "";

  useEffect(() => {
    reset(CREATE_DEFAULTS);
    setTagIds([]);
  }, [reset]);

  useEffect(() => {
    if (!selectTagId) return;
    setTagIds((ids) =>
      ids.includes(selectTagId) ? ids : [...ids, selectTagId],
    );
  }, [selectTagId]);

  const create = useMutation({
    mutationFn: ({
      values,
    }: {
      values: EmployeeValues;
      andNext: boolean;
    }) => {
      const phoneDigits = (values.phone || "").replace(/\s+/g, "").trim();
      return post<Employee>("/employees", {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email.trim(),
        phone: phoneDigits
          ? phoneDigits.startsWith("+")
            ? phoneDigits
            : `+48${phoneDigits}`
          : null,
        position_id: values.position_id || null,
        supervisor_id: values.supervisor_id || null,
        tag_ids: tagIds,
        role: values.role,
      });
    },
    onSuccess: (_row, variables) => {
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["users"] });
      client.invalidateQueries({ queryKey: ["me"] });
      if (variables.andNext) {
        reset(CREATE_DEFAULTS);
        setTagIds([]);
      } else {
        onClose();
      }
    },
  });

  const submitCreate = (andNext: boolean) =>
    handleSubmit((values) => create.mutate({ values, andNext }));

  const toggleTag = (id: string) => {
    setTagIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  return (
    <Modal
      title="Dodaj pracownika"
      size="wide"
      onClose={onClose}
      footer={
        <>
          {create.isError && (
            <Message>{(create.error as ApiError).message}</Message>
          )}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant="quiet"
            busy={create.isPending}
            onClick={() => void submitCreate(true)()}
          >
            Zapisz i dodaj następnego
          </Button>
          <Button
            type="button"
            busy={create.isPending}
            onClick={() => void submitCreate(false)()}
          >
            Zapisz
          </Button>
        </>
      }
    >
      <form
        id="create-employee-form"
        className="employee-create-form modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitCreate(false)();
        }}
      >
        <div className="field-block">
          <span className="field-block-label">
            {requiredLabel("Imię i nazwisko")}
          </span>
          <div className="stacked-inputs">
            <input
              {...register("first_name")}
              placeholder="Imię"
              aria-label="Imię"
              required
            />
            <input
              {...register("last_name")}
              placeholder="Nazwisko"
              aria-label="Nazwisko"
              required
            />
          </div>
          {(errors.first_name || errors.last_name) && (
            <span className="field-error">
              {errors.first_name?.message || errors.last_name?.message}
            </span>
          )}
        </div>

        <div className="contact-row">
          <Field label={requiredLabel("E-mail")} error={errors.email?.message}>
            <input
              type="email"
              {...register("email")}
              placeholder="karolina@example.com"
              required
            />
          </Field>
          <Field label="Telefon">
            <div className="phone-input">
              <span className="phone-prefix">+48</span>
              <input
                {...register("phone")}
                placeholder="123 123 123"
                inputMode="tel"
              />
            </div>
          </Field>
        </div>

        <Field
          label={
            <span className="field-label-row">
              Stanowisko domyślne
              <span className="field-label-actions">
                <button
                  type="button"
                  className="filter-link"
                  onClick={onAddPosition}
                >
                  Dodaj
                </button>
                <span className="subtle"> albo </span>
                <button
                  type="button"
                  className="filter-link"
                  onClick={onManagePositions}
                >
                  Zarządzaj
                </button>
              </span>
            </span>
          }
        >
          <select {...register("position_id")}>
            <option value="">Wybierz lub dodaj nowe</option>
            {positions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={
            <span className="field-label-row">
              Tagi
              <span className="field-label-actions">
                <button
                  type="button"
                  className="filter-link"
                  onClick={onAddTag}
                >
                  Dodaj
                </button>
                <span className="subtle"> albo </span>
                <button
                  type="button"
                  className="filter-link"
                  onClick={onManageTags}
                >
                  Zarządzaj
                </button>
              </span>
            </span>
          }
        >
          <div className="tag-picker">
            {tags.map((tag) => {
              const selected = tagIds.includes(tag.id);
              return (
                <label
                  key={tag.id}
                  className={`tag-pick${selected ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggleTag(tag.id)}
                  />
                  {selected ? (
                    <span className="tag-pick-check" aria-hidden>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : null}
                  <span
                    className="tag-color-dot"
                    style={{
                      background: tag.color || DEFAULT_TAG_COLOR,
                    }}
                    aria-hidden
                  />
                  {tag.name}
                  {tag.is_informational ? (
                    <span className="subtle"> · info</span>
                  ) : null}
                </label>
              );
            })}
            {!tags.length && (
              <span className="subtle">Wybierz lub dodaj nowe</span>
            )}
          </div>
        </Field>

        <Field label={requiredLabel("Rola")} error={errors.role?.message}>
          <select {...register("role")} required>
            {(isAdmin
              ? ROLE_OPTIONS
              : ROLE_OPTIONS.filter((role) => role.code === "employee")
            ).map((role) => (
              <option key={role.code} value={role.code}>
                {role.label}
              </option>
            ))}
          </select>
          <span className="field-hint">{createRoleHint}</span>
        </Field>

        <Field label="Bezpośredni przełożony">
          <select {...register("supervisor_id")}>
            <option value="">Wybierz przełożonego</option>
            {peers
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
