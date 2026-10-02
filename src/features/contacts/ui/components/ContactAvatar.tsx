export const ContactAvatar = ({
  name,
  initials,
  color,
  avatar,
  className = "avatar",
}: {
  chatId?: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string | null;
  className?: string;
}) => {
  return (
    <span className={`${className} overflow-hidden`} style={{ background: color }}>
      {avatar ? (
        <img className="size-full object-cover" src={avatar} alt={`${name} profile`} />
      ) : (
        initials
      )}
    </span>
  );
};
