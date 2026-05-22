import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint: string;
  multiple?: boolean;
  accept?: string;
  onFiles: (files: File[]) => void;
}

export function FileDropzone({ label, hint, multiple, accept, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setHovering(false);
    const list = Array.from(e.dataTransfer.files);
    if (list.length > 0) onFiles(multiple ? list : list.slice(0, 1));
  };

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed py-10 px-4 text-center transition-colors",
        hovering
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/60 hover:bg-accent/30",
      )}
      onDragOver={(e) => { e.preventDefault(); setHovering(true); }}
      onDragEnter={(e) => { e.preventDefault(); setHovering(true); }}
      onDragLeave={(e) => { e.preventDefault(); setHovering(false); }}
      onDrop={handleDrop}
    >
      <Upload className="w-8 h-8 text-muted-foreground" />
      <div className="text-base font-medium">{label}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          // Allow re-selecting the same file
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </label>
  );
}
