import { useState, type FormEvent } from "react";
import { Mail, ShieldPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { createSuperAdminApi, type CreateSuperAdminResponse } from "../api/createSuperAdminApi";
import styles from "./create-super-admin-form.module.css";

const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;

function isPasswordByteLengthValid(value: string): boolean {
  const byteLength = new TextEncoder().encode(value).length;
  return byteLength >= MIN_PASSWORD_BYTES && byteLength <= MAX_PASSWORD_BYTES;
}

export function CreateSuperAdminForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdUser, setCreatedUser] = useState<CreateSuperAdminResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCreatedUser(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setError("이름, 이메일, 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (!isPasswordByteLengthValid(password)) {
      setError("비밀번호는 UTF-8 기준 8바이트 이상 72바이트 이하로 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createSuperAdminApi({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      setCreatedUser(result);
      setName("");
      setEmail("");
      setPassword("");
      toast.success("SUPER_ADMIN 계정을 생성했습니다.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const message =
          err.code === "EMAIL_ALREADY_EXISTS" ? "이미 사용 중인 이메일입니다." : err.message;
        const errorMessage = message || "관리자 계정 생성에 실패했습니다.";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }
      const errorMessage = "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.fieldGrid}>
        <Input
          label="이름"
          icon={<UserRound size={18} />}
          placeholder="운영 관리자"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
        <Input
          label="이메일"
          icon={<Mail size={18} />}
          type="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>

      <Input
        label="임시 비밀번호"
        type="password"
        placeholder="8자 이상 72자 이하"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {createdUser && (
        <div className={styles.success} role="status">
          <strong>{createdUser.email}</strong>
          <span>{createdUser.role}</span>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit" isLoading={isLoading}>
          <ShieldPlus size={16} />
          SUPER_ADMIN 생성
        </Button>
      </div>
    </form>
  );
}
