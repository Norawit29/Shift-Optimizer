import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, History, Activity, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-100/50 dark:bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      {isAuthenticated && user && (
        <div className="fixed top-4 right-4 z-20 flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-full px-4 py-2 border shadow-sm">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
          <span className="text-sm font-medium hidden sm:inline" data-testid="text-user-name">
            {user.firstName || user.email || "User"}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.location.href = "/api/logout"}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 text-center space-y-8 max-w-3xl"
      >
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border shadow-sm text-sm font-medium text-primary mb-4">
            <Activity className="w-4 h-4" />
            <span>Hospital Shift Scheduler v1.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-slate-900 dark:text-white leading-tight">
            Fair Schedules, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Happier Staff.
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Automate your duty roster creation with our constraint-based optimizer. 
            Ensure fairness, handle requests, and save hours of manual work.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Link href="/create" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all" data-testid="button-create-schedule">
              <Plus className="mr-2 h-5 w-5" />
              Create New Schedule
            </Button>
          </Link>
          
          {isAuthenticated ? (
            <Link href="/history" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl border-2 transition-all" data-testid="button-view-history">
                <History className="mr-2 h-5 w-5" />
                View History
              </Button>
            </Link>
          ) : (
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl border-2 transition-all" 
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-sign-in"
            >
              <User className="mr-2 h-5 w-5" />
              Sign In
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          {[
            { title: "Fair Distribution", desc: "Automatically balances shifts across all available staff members." },
            { title: "Smart Constraints", desc: "Respects rest periods, consecutive shift rules, and blocked dates." },
            { title: "Instant Export", desc: "Generate Excel exports of the monthly roster in seconds." }
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
