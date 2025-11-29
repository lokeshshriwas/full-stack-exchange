"use client";

import { usePathname } from "next/navigation";
import { PrimaryButton, SuccessButton } from "./core/Button"
import { useRouter } from "next/navigation";
import { CiSearch } from "react-icons/ci";
import { useState } from "react";

export const Appbar = () => {
    const route = usePathname();
    const router = useRouter()
    const [value, setValue ] = useState('');

    return (
        <div className="relative flex h-14 w-full flex-col justify-center">
            <div className="flex items-center justify-between">
                <div className="flex items-center flex-row">
                    <a href="/" className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 focus:ring-blue-200 focus:outline-hidden disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-sm p-0 xs:mr-6 mr-3 ml-4 shrink-0 sm:ml-[21px]">LOGO</a>
                    
                    <div className="flex items-center justify-center flex-row xs:flex gap-5 sm:mx-4 sm:gap-8">
                        <div onClick={() => router.push('/markets')} className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 hover:cursor-pointer focus:ring-blue-200 focus:outline-hidden disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-xs p-0 text-med-emphasis text-slate-300">Market</div>
                        <div onClick={() => router.push('/trade/SOL_USDC')} className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 focus:ring-blue-200 focus:outline-hidden hover:cursor-pointer disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-xs p-0 text-med-emphasis text-slate-300">Trade</div>
                    </div>
                </div>
                <div className="absolute left-1/2 hidden -translate-x-1/2 justify-self-center min-[1470px]:inline-flex">
                    <div className="flex items-center justify-between flex-row bg-base-background-l2 focus-within:ring-accent-blue w-[340px] flex-1 cursor-pointer overflow-hidden rounded-xl px-1 ring-0 focus-within:ring-2">
                        <div className="flex items-center flex-row flex-1">
                            <div className="mx-2">
                                <CiSearch className="text-slate-500"/>
                            </div>
                            <input aria-label="Search markets" aria-autocomplete="list" placeholder="Search markets" id="react-aria961467334-«rb»" role="combobox" aria-expanded="false" className="bg-base-background-l2 text-high-emphasis placeholder-low-emphasis h-8 w-full border-0 p-0 text-sm font-normal outline-hidden focus:ring-0" type="text" value={value}
                            onChange={(e)=> setValue(e.target.value)}/>
                        </div>
                    </div>
                </div>
                 <div className="animate-in fade-in col-span-2 flex flex-row justify-self-end xl:col-span-1">
                    <a className="bg-base-background-l2 my-auto mr-4 rounded-lg px-2 py-1.5 text-xs font-semibold text-nowrap text-white hover:opacity-90 sm:ml-4 sm:px-3 sm:text-sm" href="/login">Log in</a>
                    <a className="text-black my-auto mr-6 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-nowrap hover:opacity-90 sm:px-3 sm:text-sm" href="/signup">Sign up</a>
                </div>
            </div>
        </div>
    )

}


 //  <div className="text-white border-b border-slate-800">
    //     <div className="flex justify-between items-center p-2">
    //         <div className="flex">
    //             <div className={`text-xl pl-4 flex flex-col justify-center cursor-pointer text-white`} onClick={() => router.push('/')}>
    //                 Exchange
    //             </div>
    //             <div className={`text-sm pt-1 flex flex-col justify-center pl-8 cursor-pointer ${route.startsWith('/markets') ? 'text-white' : 'text-slate-500'}`} onClick={() => router.push('/markets')}>
    //                 Markets
    //             </div>
    //             <div className={`text-sm pt-1 flex flex-col justify-center pl-8 cursor-pointer ${route.startsWith('/trade') ? 'text-white' : 'text-slate-500'}`} onClick={() => router.push('/trade/SOL_USDC')}>
    //                 Trade
    //             </div>
    //         </div>
    //         <div className="flex">
    //             <div className="p-2 mr-2">
    //                 <SuccessButton>Deposit</SuccessButton>
    //                 <PrimaryButton>Withdraw</PrimaryButton>
    //             </div>
    //         </div>
    //     </div>
    // </div>