type InputProps = {
  label: string;
  type?: string;
  placeholder?: string;
};

export default function Input({
  label,
  type = "text",
  placeholder,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="rounded-lg bg-gray-800 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
