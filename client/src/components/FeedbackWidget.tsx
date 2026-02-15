import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquarePlus, Send, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setOpen(false);
          setTimeout(() => {
            setSubmitted(false);
            setRating(0);
            setComment("");
          }, 300);
        }, 1500);
      }
    } catch {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: lang === "th" ? "ส่ง feedback ไม่สำเร็จ" : "Could not submit feedback",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayStar = hoveredStar || rating;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            className="rounded-full shadow-lg shadow-primary/25 gap-2"
            data-testid="button-feedback-trigger"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="text-sm">Feedback</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-72 p-0 overflow-hidden bg-background border shadow-xl"
        >
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-sm">
                {lang === "th" ? "ขอบคุณสำหรับ Feedback!" : "Thank you for your feedback!"}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-primary/10 to-transparent dark:from-primary/20 px-4 py-3">
                <p className="font-semibold text-sm">
                  {lang === "th" ? "ให้คะแนนแอปนี้" : "Rate this app"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "th" ? "ความคิดเห็นของคุณช่วยพัฒนาระบบ" : "Your feedback helps us improve"}
                </p>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-center gap-1" data-testid="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(star)}
                      data-testid={`button-star-${star}`}
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          star <= displayStar
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    {rating === 1 && (lang === "th" ? "ต้องปรับปรุง" : "Needs improvement")}
                    {rating === 2 && (lang === "th" ? "พอใช้" : "Fair")}
                    {rating === 3 && (lang === "th" ? "ปานกลาง" : "Good")}
                    {rating === 4 && (lang === "th" ? "ดี" : "Very good")}
                    {rating === 5 && (lang === "th" ? "ดีมาก" : "Excellent")}
                  </p>
                )}
                <Textarea
                  placeholder={lang === "th" ? "ความคิดเห็นเพิ่มเติม (ไม่บังคับ)" : "Additional comments (optional)"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="resize-none text-sm min-h-[60px]"
                  rows={2}
                  data-testid="textarea-feedback-comment"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={rating === 0 || submitting}
                  className="w-full"
                  data-testid="button-submit-feedback"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {lang === "th" ? "ส่ง Feedback" : "Submit"}
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
