import { useState } from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PreferenceRow } from "./PreferenceComponents";

export interface VisibilityOption {
  value: string;
  label: string;
  description?: string;
}

interface VisibilitySelectorProps {
  title: string;
  description?: string;
  value: string;
  options: VisibilityOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const VisibilitySelector = ({
  title,
  description,
  value,
  options,
  onChange,
  disabled
}: VisibilitySelectorProps) => {
  const [open, setOpen] = useState(false);
  
  // Find current label for display
  const currentLabel = options.find(opt => opt.value === value)?.label || value;

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    // Give a small delay before closing to show selection feedback
    setTimeout(() => setOpen(false), 300);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <div>
          <PreferenceRow
            label={title}
            subLabel={description}
            rightValue={currentLabel}
            onClick={() => !disabled && setOpen(true)}
            hasArrow={!disabled}
          />
        </div>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="p-4 pb-0">
            <RadioGroup value={value} onValueChange={handleSelect} className="gap-0">
              {options.map((option, index) => (
                <div key={option.value}>
                  <div className="flex items-center space-x-2 py-4">
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="grid gap-1.5 leading-none flex-1 cursor-pointer" onClick={() => handleSelect(option.value)}>
                      <Label
                        htmlFor={option.value}
                        className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      {option.description && (
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {index < options.length - 1 && <div className="h-px bg-border" />}
                </div>
              ))}
            </RadioGroup>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
