import { BookOpen, Book, FolderArchive } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { TopicBox } from "../_types";

interface BoxCardProps {
  box: TopicBox;
}

/**
 * Akademik Konu Kutusu (Topic Box) kart bileşeni.
 * Kutunun adını, açıklamasını ve içindeki makalelerin (Starter Pack) listesini okunma durumlarıyla sergiler.
 *
 * @param props.box - Görüntülenecek konu kutusu verisi
 */
export function BoxCard({ box }: BoxCardProps) {
  return (
    <Card className="flex flex-col h-full rounded-md border border-border bg-card text-card-foreground">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="font-serif text-lg font-medium tracking-tight text-foreground">
              {box.title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground line-clamp-2">
              {box.description}
            </CardDescription>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
            <FolderArchive className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0">
        <div className="border-t border-border/40 my-3" />
        <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Başlangıç Paketi (Starter Pack)
        </h4>
        {box.articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-3 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center">
            <p className="text-xs text-success font-medium">
              Tüm kaynak okumaları tamamlandı!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {box.articles.map((article) => (
              <li
                key={article.id}
                className="flex items-start justify-between gap-3 group rounded-md p-2 hover:bg-secondary/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  <p className="font-sans text-xs text-muted-foreground mt-1 truncate">
                    {article.author}
                    {article.year && article.year > 0
                      ? ` (${article.year})`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center pt-0.5 shrink-0">
                  {article.isRead ? (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 border border-success/20 text-success"
                      title="Okundu"
                    >
                      <BookOpen className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground"
                      title="Okunmadı"
                    >
                      <Book className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
