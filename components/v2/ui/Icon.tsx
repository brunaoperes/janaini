'use client';

import {
  LayoutDashboard, CalendarDays, ReceiptText, Users, UserCog, Scissors, Wallet,
  HandCoins, ChartColumnIncreasing, Package, MessageCircle, Settings, LayoutGrid,
  CircleHelp, Sun, Calculator, Clock, ChartPie, FolderOpen, Gift, SlidersHorizontal,
  UserPlus, ShieldCheck, CreditCard, ScrollText, Bell, ChevronDown, ChevronLeft,
  ChevronRight, Filter, Plus, Search, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight,
  DollarSign, Landmark, Percent, Target, CircleAlert, Star, Trophy, Banknote, Gauge,
  Sparkles, Check, X, Download, RotateCcw, ArrowUpDown, Cake, PiggyBank, CalendarClock,
  Info, ChartNoAxesColumn, Coins, Receipt, type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarDays, ReceiptText, Users, UserCog, Scissors, Wallet,
  HandCoins, ChartColumnIncreasing, Package, MessageCircle, Settings, LayoutGrid,
  CircleHelp, Sun, Calculator, Clock, ChartPie, FolderOpen, Gift, SlidersHorizontal,
  UserPlus, ShieldCheck, CreditCard, ScrollText, Bell, ChevronDown, ChevronLeft,
  ChevronRight, Filter, Plus, Search, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight,
  DollarSign, Landmark, Percent, Target, CircleAlert, Star, Trophy, Banknote, Gauge,
  Sparkles, Check, X, Download, RotateCcw, ArrowUpDown, Cake, PiggyBank, CalendarClock,
  Info, ChartNoAxesColumn, Coins, Receipt,
};

export default function Icon({ name, size = 18, className, strokeWidth = 1.75 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const Cmp = REGISTRY[name] ?? Sparkles;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
