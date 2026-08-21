import { Search } from "lucide-react";

export function SearchInput({ defaultValue, placeholder, name = "q" }: { defaultValue?: string; placeholder: string; name?: string }) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
      <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
