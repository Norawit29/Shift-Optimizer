import { useState } from "react";
import { useCreateSchedule } from "@/hooks/use-schedules";
import { type StaffMember, type SchedulerConfig, type OptimizerResult, type DaySchedule } from "@shared/schema";
import { ShiftOptimizer } from "@/lib/optimizer";
import { WizardStep } from "@/components/WizardStep";
import { ScheduleView } from "@/components/ScheduleView";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Users, 
  Calendar as CalendarIcon, 
  Settings2, 
  PlayCircle,
  Plus,
  X,
  Save,
  Loader2,
  Activity,
  History,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import { Link, useLocation } from "wouter";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const INITIAL_CONFIG: SchedulerConfig = {
  shiftsPerDay: 3,
  shiftNames: ["Morning", "Evening", "Night"],
  staffPerShift: [2, 2, 1],
  consecutiveRules: [{ from: 2, to: 0 }], // No Night -> Morning
};

const INITIAL_STAFF: StaffMember[] = [
  { id: "1", name: "Dr. Smith", maxShifts: 20, blocked: [] },
  { id: "2", name: "Nurse Joy", maxShifts: 22, blocked: [] },
  { id: "3", name: "Dr. House", maxShifts: 15, blocked: [] },
  { id: "4", name: "Nurse Jackie", maxShifts: 22, blocked: [] },
  { id: "5", name: "Dr. Grey", maxShifts: 20, blocked: [] },
];

export default function WizardPage() {
  const [step, setStep] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [config, setConfig] = useState<SchedulerConfig>(INITIAL_CONFIG);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [scheduleName, setScheduleName] = useState("My Schedule");
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const createMutation = useCreateSchedule();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // --- Handlers ---

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const updateShiftName = (idx: number, name: string) => {
    const newNames = [...config.shiftNames];
    newNames[idx] = name;
    setConfig({ ...config, shiftNames: newNames });
  };

  const updateStaffCount = (idx: number, count: number) => {
    const newCounts = [...config.staffPerShift];
    newCounts[idx] = count;
    setConfig({ ...config, staffPerShift: newCounts });
  };

  const addStaff = () => {
    setStaff([...staff, { id: nanoid(), name: "New Staff", maxShifts: 20, blocked: [] }]);
  };

  const removeStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const updateStaff = (id: string, field: keyof StaffMember, value: any) => {
    setStaff(staff.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const runOptimizer = () => {
    setIsOptimizing(true);
    // Use setTimeout to allow UI to render loading state
    setTimeout(() => {
      try {
        const optimizer = new ShiftOptimizer(config, staff, month, year);
        const res = optimizer.optimize();
        setResult(res);
        setStep(4);
        toast({ title: "Schedule Generated", description: "Optimization complete!" });
      } catch (e: any) {
        toast({ 
          title: "Optimization Failed", 
          description: e.message || "Could not satisfy all constraints. Try adding more staff or loosening rules.", 
          variant: "destructive" 
        });
      } finally {
        setIsOptimizing(false);
      }
    }, 500);
  };

  const saveSchedule = async () => {
    if (!result) return;
    try {
      await createMutation.mutateAsync({
        name: scheduleName,
        month,
        year,
        config,
        staff,
        result: result.schedule as any,
        isPublished: false
      });
      setLocation("/history");
    } catch (error) {
      // handled by mutation hook
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl font-display text-primary">Scheduler Wizard</span>
              <Badge variant="outline" className="ml-2">Step {step}/4</Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {step === 4 && (
              <Button onClick={saveSchedule} disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2" />}
                Save Schedule
              </Button>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out" 
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* STEP 1: CONFIGURATION */}
        <WizardStep 
          isActive={step === 1} 
          title="Basic Configuration" 
          description="Set up the timeline and shift structure for your roster."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Timeline</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Shifts per Day</Label>
                    <Badge variant="secondary">{config.shiftsPerDay}</Badge>
                  </div>
                  <Slider 
                    value={[config.shiftsPerDay]} 
                    min={1} 
                    max={5} 
                    step={1} 
                    onValueChange={([val]) => {
                      const newNames = [...config.shiftNames];
                      const newCounts = [...config.staffPerShift];
                      if (val > config.shiftsPerDay) {
                        for(let i=config.shiftsPerDay; i<val; i++) {
                          newNames.push(`Shift ${i+1}`);
                          newCounts.push(1);
                        }
                      } else {
                        newNames.splice(val);
                        newCounts.splice(val);
                      }
                      setConfig({ ...config, shiftsPerDay: val, shiftNames: newNames, staffPerShift: newCounts });
                    }} 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
              <CardContent className="p-6 space-y-6">
                <Label className="text-base font-semibold">Shift Details</Label>
                <div className="space-y-4">
                  {config.shiftNames.map((name, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={e => updateShiftName(i, e.target.value)} />
                      </div>
                      <div className="w-24 space-y-2">
                        <Label>Staff Req.</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={config.staffPerShift[i]} 
                          onChange={e => updateStaffCount(i, parseInt(e.target.value))} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </WizardStep>

        {/* STEP 2: STAFF MANAGEMENT */}
        <WizardStep 
          isActive={step === 2} 
          title="Staff Management" 
          description="Add your team members and set their monthly capacity."
        >
          <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={addStaff} variant="outline" className="border-dashed">
                    <Plus className="w-4 h-4 mr-2" /> Add Staff Member
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staff.map((s) => (
                    <div key={s.id} className="relative group bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeStaff(s.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <Input 
                          value={s.name} 
                          onChange={e => updateStaff(s.id, "name", e.target.value)} 
                          className="font-semibold h-8 border-transparent hover:border-input focus:border-input px-2 -ml-2"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-sm mb-4">
                        <Label className="text-muted-foreground">Max Shifts</Label>
                        <Input 
                          type="number" 
                          className="w-16 h-8 text-right"
                          value={s.maxShifts}
                          onChange={e => updateStaff(s.id, "maxShifts", parseInt(e.target.value))}
                        />
                      </div>

                      <Separator className="my-3" />
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Blocked Shifts</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const newBlocked = [...(s.blocked || []), { date: 1, shift: -1 }];
                              updateStaff(s.id, "blocked", newBlocked);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {(s.blocked || []).map((b, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded border text-xs">
                              <div className="flex-1 flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Day</span>
                                <Input 
                                  type="number" 
                                  min={1} 
                                  max={31}
                                  value={b.date} 
                                  className="h-6 w-10 p-1 text-center"
                                  onChange={e => {
                                    const newBlocked = [...s.blocked];
                                    newBlocked[bIdx] = { ...b, date: parseInt(e.target.value) || 1 };
                                    updateStaff(s.id, "blocked", newBlocked);
                                  }}
                                />
                                <span className="text-[10px] text-muted-foreground ml-1">Shift</span>
                                <Select 
                                  value={b.shift.toString()} 
                                  onValueChange={v => {
                                    const newBlocked = [...s.blocked];
                                    newBlocked[bIdx] = { ...b, shift: parseInt(v) };
                                    updateStaff(s.id, "blocked", newBlocked);
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-[10px] px-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="-1">All Day</SelectItem>
                                    {config.shiftNames.map((name, i) => (
                                      <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const newBlocked = s.blocked.filter((_, i) => i !== bIdx);
                                  updateStaff(s.id, "blocked", newBlocked);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          {(!s.blocked || s.blocked.length === 0) && (
                            <p className="text-[10px] text-center text-muted-foreground py-2 italic">No blocks set</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </WizardStep>

        {/* STEP 3: CONSTRAINTS */}
        <WizardStep 
          isActive={step === 3} 
          title="Rules & Constraints" 
          description="Define fairness rules and consecutive shift patterns."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <Settings2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Consecutive Shift Rules</h3>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Prevent staff from working specific shift combinations on consecutive days (e.g., Night → Morning).
                </p>

                <div className="space-y-2">
                  {config.consecutiveRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                      <span className="text-red-500 font-bold">NO</span>
                      <Badge variant="outline">{config.shiftNames[rule.from]}</Badge>
                      <span className="text-muted-foreground text-sm">followed by</span>
                      <Badge variant="outline">{config.shiftNames[rule.to]}</Badge>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => {
                         const newRules = config.consecutiveRules.filter((_, i) => i !== idx);
                         setConfig({...config, consecutiveRules: newRules});
                      }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-2 pt-2">
                     <Select onValueChange={(val) => {
                       const [from, to] = val.split(',').map(Number);
                       setConfig({
                         ...config,
                         consecutiveRules: [...config.consecutiveRules, { from, to }]
                       });
                     }}>
                       <SelectTrigger className="w-full">
                         <SelectValue placeholder="Add new rule..." />
                       </SelectTrigger>
                       <SelectContent>
                         {config.shiftNames.map((name1, i) => (
                           config.shiftNames.map((name2, j) => (
                             <SelectItem key={`${i}-${j}`} value={`${i},${j}`}>
                               Block {name1} → {name2}
                             </SelectItem>
                           ))
                         ))}
                       </SelectContent>
                     </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center p-6">
               <div className="text-center space-y-4">
                 <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                   <PlayCircle className="h-10 w-10 text-primary" />
                 </div>
                 <h3 className="text-xl font-bold">Ready to Optimize?</h3>
                 <p className="text-muted-foreground max-w-xs mx-auto">
                   Our algorithm will attempt to find the fairest distribution of shifts while respecting all your constraints.
                 </p>
                 <Button size="lg" onClick={runOptimizer} disabled={isOptimizing} className="mt-4 w-full">
                   {isOptimizing ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing...
                     </>
                   ) : (
                     <>Generate Schedule</>
                   )}
                 </Button>
               </div>
            </div>
          </div>
        </WizardStep>

        {/* STEP 4: RESULTS */}
        {step === 4 && result && (
          <WizardStep 
            isActive={true} 
            title="Generated Schedule"
            className="max-w-6xl"
          >
            <div className="space-y-8">
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border">
                <div className="flex-1">
                  <Label>Schedule Name</Label>
                  <Input 
                    value={scheduleName} 
                    onChange={e => setScheduleName(e.target.value)} 
                    className="text-lg font-bold border-none shadow-none focus-visible:ring-0 px-0"
                  />
                </div>
                <Button variant="outline" onClick={() => setStep(3)}>
                  <Settings2 className="w-4 h-4 mr-2" /> Adjust Rules
                </Button>
                <Button variant="outline" onClick={runOptimizer}>
                  <History className="w-4 h-4 mr-2" /> Regenerate
                </Button>
              </div>

              <Tabs defaultValue="calendar">
                <TabsList className="mb-4">
                  <TabsTrigger value="calendar"><CalendarIcon className="w-4 h-4 mr-2" />Calendar View</TabsTrigger>
                  <TabsTrigger value="summary"><Check className="w-4 h-4 mr-2" />Summary</TabsTrigger>
                  <TabsTrigger value="stats"><Activity className="w-4 h-4 mr-2" />Statistics</TabsTrigger>
                </TabsList>
                
                <TabsContent value="calendar" className="mt-0">
                  <ScheduleView 
                    schedule={result.schedule} 
                    config={config} 
                    staff={staff} 
                    month={month} 
                    year={year} 
                  />
                </TabsContent>

                <TabsContent value="summary" className="mt-0">
                  <Card className="shadow-md">
                    <CardContent className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b bg-slate-50 dark:bg-slate-900">
                              <th className="p-3 text-left font-semibold">Staff Name</th>
                              {config.shiftNames.map((name, i) => (
                                <th key={i} className="p-3 text-center font-semibold">{name}</th>
                              ))}
                              <th className="p-3 text-center font-semibold text-primary">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.metrics.perStaff.map((s, i) => (
                              <tr key={i} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="p-3 font-medium">{s.name}</td>
                                {s.byShift.map((count, j) => (
                                  <td key={j} className="p-3 text-center">{count}</td>
                                ))}
                                <td className="p-3 text-center font-bold text-primary">{s.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="stats" className="mt-0">
                  <StatsCard result={result} config={config} />
                </TabsContent>
              </Tabs>
            </div>
          </WizardStep>
        )}

        {/* Navigation Footer */}
        {step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-950 border-t z-40">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                disabled={step === 1}
                className="text-muted-foreground"
              >
                Back
              </Button>
              
              <div className="flex gap-2">
                {step < 3 ? (
                  <Button onClick={handleNext} className="px-8 rounded-full shadow-lg shadow-primary/25">
                    Next Step <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="opacity-0">Placeholder</Button> // Hidden on step 3 to force "Generate" button use
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
