import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { ENTERPRISE_CONTACT } from "@/entities/billing";

interface EnterpriseContactDialogProps {
  triggerLabel?: string;
}

/**
 * Enterprise 도입 문의 다이얼로그. 카드결제(Toss) 대신 연락처를 제시한다 — register 흐름을 호출하지 않는다.
 */
export function EnterpriseContactDialog({
  triggerLabel = "도입 문의",
}: EnterpriseContactDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full rounded-full px-6">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enterprise 도입 문의</DialogTitle>
          <DialogDescription>
            조직 규모 도입과 맞춤 지원이 필요하신가요? 아래 연락처로 문의해 주시면 담당자가 요금제와
            온보딩을 안내해 드립니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 rounded-md bg-muted p-4">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            전화 문의
          </span>
          <a
            href={`tel:${ENTERPRISE_CONTACT.phone}`}
            className="text-xl font-semibold tracking-tight tabular-nums"
          >
            {ENTERPRISE_CONTACT.phone}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
