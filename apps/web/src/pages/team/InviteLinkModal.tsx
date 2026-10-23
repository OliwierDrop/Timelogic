import { Button, Modal } from "../../components";

export function InviteLinkModal({
  inviteLink,
  onClose,
  title = "Link zaproszenia",
  description = "Mail nie został wysłany (brak SMTP). Skopiuj link i prześlij go pracownikowi.",
}: {
  inviteLink: string;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <Modal
      title={title}
      description={description}
      layer={1}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Zamknij
          </Button>
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink);
            }}
          >
            Kopiuj link
          </Button>
        </>
      }
    >
      <input
        className="invite-link-input"
        readOnly
        value={inviteLink}
        onFocus={(e) => e.target.select()}
      />
    </Modal>
  );
}
