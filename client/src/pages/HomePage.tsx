import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";

export default function HomePage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-16 sm:p-4 overflow-x-hidden relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LanguageToggle />
        {!loading && (user ? <UserMenu /> : <GoogleSignInButton />)}
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-100/50 dark:bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 text-center space-y-8 max-w-3xl"
      >
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border shadow-sm text-sm font-medium text-primary mb-4">
            <Activity className="w-4 h-4" />
            <span>{t.appName}</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-display font-bold text-slate-900 dark:text-white leading-tight break-words">
            {t.heroTitle1} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent text-xl sm:text-2xl md:text-4xl break-words">
              {t.heroTitle2}
            </span>
          </h1>
          
          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t.heroDesc.split("\n").map((line, i) => (
              <span key={i}>{line}{i < t.heroDesc.split("\n").length - 1 && <br />}</span>
            ))}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 flex-wrap">
          <Link href="/create" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20" data-testid="button-create-schedule">
              <Plus className="mr-2 h-5 w-5" />
              {t.createNewSchedule}
            </Button>
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          {[
            { title: t.featureFairTitle, desc: t.featureFairDesc },
            { title: t.featureSmartTitle, desc: t.featureSmartDesc },
            { title: t.featureExportTitle, desc: t.featureExportDesc }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="bg-white/60 dark:bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="text-slate-500 dark:text-slate-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
