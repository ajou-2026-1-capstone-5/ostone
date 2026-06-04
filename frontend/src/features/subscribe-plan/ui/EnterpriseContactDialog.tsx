import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { ENTERPRISE_CONTACT } from "@/entities/billing";

interface EnterpriseContactDialogProps {
  triggerLabel?: string;
}

/**
 * Enterprise 도입 문의 다이얼로그. 카드결제(Toss) 대신 연락처를 제시한다 — register 흐름을 호출하지 않는다.
 * 애플 이중인증(2FA) 스타일: 전화번호를 rounded-rectangle 박스에 담아 크게 노출하고, 박스 전체가
 * tel: 링크라 누르면 바로 연결된다. 제목/안내문구는 시각적으로 숨긴다(a11y용 sr-only).
 */
export function EnterpriseContactDialog({
  triggerLabel = "도입 문의",
}: EnterpriseContactDialogProps) {
  const telHref = `tel:${ENTERPRISE_CONTACT.phone}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 w-full rounded-full px-6">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Enterprise 도입 문의</DialogTitle>
        <div className="flex flex-col items-center gap-5 px-5! py-10! text-center">
          <a
            href={telHref}
            data-testid="enterprise-phone-link"
            className="flex w-full items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--paper-3)] px-6! py-8! text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums whitespace-nowrap text-foreground transition-colors outline-none hover:border-[var(--ink-3)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {ENTERPRISE_CONTACT.phone}
          </a>
          <span className="text-[11px] text-muted-foreground">
            평일 10:00 – 18:00 · 점심시간 12:00 – 13:00 제외
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
