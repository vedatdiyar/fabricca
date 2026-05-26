"use client";

import React, { FormEvent } from "react";
import { Plus, Calendar, Loader2, AlertCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { format, parse } from "date-fns";
import { tr } from "date-fns/locale";

interface TaskFormProps {
  description: string;
  setDescription: (val: string) => void;
  dueDate: string;
  setDueDate: (val: string) => void;
  submitting: boolean;
  errorMessage: string;
  onSubmit: (e: FormEvent) => void;
}

export function TaskForm({
  description,
  setDescription,
  dueDate,
  setDueDate,
  submitting,
  errorMessage,
  onSubmit,
}: TaskFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border border-border p-6 rounded-lg mb-8 space-y-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Plus className="size-4" />
        <span>Yeni Görev Tanımla</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <Input
            type="text"
            placeholder="Örn: Literatür taramasını tamamla ve özet çıkar..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary font-sans h-10"
          />
        </div>
        <div className="md:col-span-1">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  type="button"
                  className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground h-10 flex items-center justify-start gap-2 cursor-pointer focus:outline-none focus:border-primary hover:bg-muted font-normal"
                />
              }
            >
              <Calendar className="size-4 text-primary shrink-0" />
              <span>
                {dueDate
                  ? format(
                      parse(dueDate, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "gg/aa/yyyy"}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={
                  dueDate ? parse(dueDate, "yyyy-MM-dd", new Date()) : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    setDueDate(format(date, "yyyy-MM-dd"));
                  } else {
                    setDueDate("");
                  }
                }}
                locale={tr}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="md:col-span-1">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full text-sm font-semibold rounded h-10 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4" />
                <span>Görev Ekle</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive/10 text-destructive-foreground"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-none">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
