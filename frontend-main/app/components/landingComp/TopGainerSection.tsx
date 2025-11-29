import React from 'react'
import TopGainerCard from './TopGainerCard'
import { exploreNew, getTopGainers, mostPopular } from '@/app/utils/helper';

const TopGainerSection = ({tableData} : {tableData: any}) => {
    const topGainer = getTopGainers(tableData);
    const popular = mostPopular(tableData);
    const newCrypto = exploreNew(tableData);
    
  return (
    <div className='grid w-full items-center gap-4 sm:grid-cols-2 md:grid-cols-3'> 
        <TopGainerCard header="New" tableData={newCrypto}/>
        <TopGainerCard header="Top Gainer" tableData={topGainer}/>
        <TopGainerCard header="Popular" tableData={popular}/>
    </div>
  )
}

export default TopGainerSection