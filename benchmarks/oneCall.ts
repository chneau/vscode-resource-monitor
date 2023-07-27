import prettyBytes from "pretty-bytes";
import { get } from "systeminformation";

interface GetAllResult {
  currentLoad: { currentLoad: number };
  mem: { active: number };
  networkStats: { rx_sec: number | null; tx_sec: number | null }[];
  fsStats: { rx_sec: number | null; wx_sec: number | null };
}
const getAllInOneCall = async () => {
  const { currentLoad, mem, networkStats, fsStats }: GetAllResult = await get({ currentLoad: "currentLoad", mem: "active", networkStats: "rx_sec,tx_sec", fsStats: "rx_sec,wx_sec" });
  const currentLoadText = `$(pulse)${currentLoad?.currentLoad?.toFixed(2)}%`;
  const memText = `$(server)${prettyBytes(mem.active)}`;
  const networkStatsText = `$(cloud-download)${prettyBytes(networkStats?.[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(networkStats?.[0]?.tx_sec ?? 0)}`;
  const fsStatsText = `$(log-in)${prettyBytes(fsStats?.wx_sec ?? 0)}$(log-out)${prettyBytes(fsStats?.rx_sec ?? 0)}`;
  return `${currentLoadText} ${memText} ${networkStatsText} ${fsStatsText}`;
};

for (let i = 0; i < 100; i++) {
  console.log(await getAllInOneCall());
}
