import { getMarkets } from "../utils/httpClient"

export default async function Page() {
    const response = await getMarkets();

    return <div className="flex flex-row flex-1">
        <div className="flex flex-col justify-center items-center flex-1 pt-[100px]">
            Markets page
            <h1>
                {JSON.stringify(response)}
            </h1>
        </div>
    </div>
}