"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { FaCoins, FaCheck, FaSpinner, FaArrowRight, FaGoogle } from "react-icons/fa";

const PLANS = [
  {
    id: "basic",
    name: "Basic Pack",
    credits: 1000,
    price: "$5",
    desc: "Great for testing out a few styles on your pet",
    features: [
      "~83 Pet Portrait Generations",
      "Up to 5 Pet Photo Inputs",
      "High-Resolution HD Downloads",
      "Private Studio Gallery Store",
      "Standard Image Queue Speeds"
    ]
  },
  {
    id: "standard",
    name: "Standard Pack",
    credits: 2000,
    price: "$10",
    desc: "Perfect for testing custom look combinations",
    features: [
      "~166 Pet Portrait Generations",
      "Up to 5 Pet Photo Inputs",
      "High-Resolution HD Downloads",
      "Private Studio Gallery Store",
      "Priority Rendering Queue"
    ]
  },
  {
    id: "pro",
    name: "Professional Pack",
    credits: 4000,
    price: "$20",
    desc: "Ideal for pet design catalogs and print planning",
    popular: true,
    features: [
      "~333 Pet Portrait Generations",
      "Unlimited Creation History",
      "Up to 5 Pet Photo Inputs",
      "Priority Rendering Queue",
      "High-Resolution HD Downloads",
      "Premium Direct Email Support"
    ]
  },
  {
    id: "business",
    name: "Business Pack",
    credits: 10000,
    price: "$50",
    desc: "For professional digital pet art shops",
    features: [
      "~833 Pet Portrait Generations",
      "Commercial Usage License Included",
      "Instant Cloud Generation Speeds",
      "Priority 24/7 Dedicated Support",
      "Advanced Prompt Guidance Tuning",
      "Up to 5 Pet Photo Inputs"
    ]
  }
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success")) {
        setTimeout(() => setSuccess(true), 0);
      }
      if (params.get("canceled")) {
        setTimeout(() => setCanceled(true), 0);
      }
    }
  }, []);

  const handlePurchase = async (planId) => {
    if (!session?.user) { signIn("google"); return; }
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.url) window.location.assign(d.url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Block */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-650 bg-emerald-50 border border-emerald-250 px-3.5 py-1.5 rounded-full shadow-sm">
            Credit Packages
          </span>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mt-4">
            Simple, One-Time Credit Purchases
          </h1>
          <p className="text-sm text-zinc-500 mt-2 font-medium">
            No monthly subscriptions, use them whenever you need. Each AI pet portrait generation costs <strong className="text-emerald-600 font-bold">12 credits</strong>.
          </p>
        </div>

        {/* Transaction Alerts */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-250 rounded-2xl p-6 mb-8 text-center max-w-xl mx-auto shadow-md animate-in fade-in zoom-in duration-200">
            <div className="h-10 w-10 bg-emerald-600 rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg">
              <FaCheck className="text-sm" />
            </div>
            <h3 className="text-sm font-bold text-emerald-800">Purchase Successful!</h3>
            <p className="text-xs text-emerald-700 leading-relaxed mt-1 max-w-sm mx-auto">
              Your credits have been added successfully to your account. Return to the studio to transform new pet photos!
            </p>
            <button
              onClick={() => window.location.assign("/")}
              className="mt-4 inline-flex items-center gap-1.5 px-4.5 py-2 bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md hover:scale-[1.02]"
            >
              Go to Studio <FaArrowRight className="text-[9px]" />
            </button>
          </div>
        )}

        {/* Transaction Canceled Alert */}
        {canceled && (
          <div className="bg-amber-50 border border-amber-250 rounded-2xl p-4 mb-8 text-center max-w-xl mx-auto shadow-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-sm font-bold text-amber-800">Transaction Canceled</h3>
            <p className="text-xs text-amber-700 mt-1 font-medium">
              The Stripe checkout session was canceled. No charges were made to your account.
            </p>
          </div>
        )}

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const isLoading = loadingPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white border rounded-2xl overflow-hidden p-6 flex flex-col justify-between shadow-md transition-all hover:border-zinc-350 hover:scale-[1.01] relative ${
                  plan.popular
                    ? "border-emerald-500 ring-2 ring-emerald-500/10 scale-[1.02] z-10"
                    : "border-zinc-200"
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-emerald-650 bg-emerald-50 border border-emerald-250 px-2.5 py-0.5 rounded shadow">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{plan.name}</h3>
                  <p className="text-[11px] text-zinc-500 font-bold mt-1.5 leading-snug">{plan.desc}</p>
                  
                  {/* Price Display */}
                  <div className="flex items-baseline gap-1 my-5">
                    <span className="text-3xl font-bold text-zinc-900">{plan.price}</span>
                    <span className="text-xs text-zinc-450 font-bold">one-time</span>
                  </div>

                  {/* Feature List */}
                  <ul className="space-y-2.5 text-xs text-zinc-700 mb-6 font-medium">
                    <li className="flex items-center gap-2 text-amber-850 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg mb-4">
                      <FaCoins className="text-amber-600 text-xs animate-pulse" />
                      <span>{plan.credits} Credits</span>
                    </li>
                    
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <FaCheck className="text-emerald-500 text-[10px] flex-shrink-0 mt-1" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Buy Button */}
                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    plan.popular
                      ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-650 text-white shadow-emerald-500/10 hover:scale-[1.01]"
                      : "bg-zinc-100 hover:bg-zinc-200 text-zinc-750"
                  }`}
                >
                  {isLoading ? (
                    <FaSpinner className="animate-spin text-xs text-white" />
                  ) : !session?.user ? (
                    <>
                      <FaGoogle className="text-[10px]" />
                      <span>Sign in to Purchase</span>
                    </>
                  ) : (
                    <span>Get {plan.credits} Credits</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
