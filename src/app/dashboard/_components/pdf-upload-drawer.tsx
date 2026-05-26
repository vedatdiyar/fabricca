"use client";

import React from "react";
import { Upload, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { LiteratureRecommendation } from "../actions";

interface PdfUploadDrawerProps {
  selectedRec: LiteratureRecommendation | null;
  onClose: () => void;
}

export function PdfUploadDrawer({
  selectedRec,
  onClose,
}: PdfUploadDrawerProps) {
  return (
    <Drawer
      open={selectedRec !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            <Upload className="size-4 text-primary" />
            <span>PDF Yükle</span>
          </DrawerTitle>
          <DrawerClose>
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>
        <div className="flex flex-col flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Siber-akademik uyarı */}
          <div className="bg-background border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bu makaleyi Danışman Odası&apos;nda kuramsal tartışmaya açmak için
              tam metin PDF dosyası gereklidir. Lütfen kaynağın resmi
              sayfasından indirdiğiniz PDF&apos;i aşağıya yükleyin.
            </p>
          </div>

          {/* Seçili kaynak künyesi */}
          {selectedRec && (
            <div className="bg-background border-l-2 border-primary pl-3 py-2 space-y-1">
              <p className="text-xs text-foreground font-bold leading-snug">
                {selectedRec.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedRec.authors} ({selectedRec.year})
              </p>
            </div>
          )}

          {/* Minimalist Dropzone */}
          <div className="flex-1 border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 text-center hover:border-primary transition duration-150 cursor-pointer group">
            <div className="size-12 rounded-full bg-secondary border border-border flex items-center justify-center group-hover:border-primary transition duration-150">
              <Upload className="size-5 text-muted-foreground group-hover:text-primary transition duration-150" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                PDF Seç veya Sürükle-Bırak
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                .pdf — Maks. 20MB
              </p>
            </div>
          </div>

          {/* Mock upload notu */}
          <p className="text-[9px] text-muted-foreground text-center">
            Yükleme lojiği RAG aşamasında eklenecektir.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
