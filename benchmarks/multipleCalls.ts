import prettyBytes from "pretty-bytes";
import { currentLoad, fsStats, mem, networkStats } from "systeminformation";

const getCurrentLoadText = async () => {
  const cl = await currentLoad();
  return `$(pulse)${cl.currentLoad.toFixed(2)}%`;
};

const getMemText = async () => {
  const m = await mem();
  return `$(server)${prettyBytes(m.active)}`;
};

const getNetworkStatsText = async () => {
  const ns = await networkStats();
  return `$(cloud-download)${prettyBytes(ns?.[0]?.rx_sec ?? 0)}$(cloud-upload)${prettyBytes(ns?.[0]?.tx_sec ?? 0)}`;
};

const getFsStatsText = async () => {
  const fs = await fsStats();
  return `$(log-in)${prettyBytes(fs.wx_sec ?? 0)}$(log-out)${prettyBytes(fs.rx_sec ?? 0)}`;
};

const getAllInIndividualCalls = async () => {
  const [currentLoadText, memText, networkStatsText, fsStatsText] = await Promise.all([getCurrentLoadText(), getMemText(), getNetworkStatsText(), getFsStatsText()]);
  return `${currentLoadText} ${memText} ${networkStatsText} ${fsStatsText}`;
};

for (let i = 0; i < 100; i++) {
  console.log(await getAllInIndividualCalls());
}
