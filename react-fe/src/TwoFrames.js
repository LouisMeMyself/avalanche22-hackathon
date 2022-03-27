/* This example requires Tailwind CSS v2.0+ */

import ListBoxes from "./ListBoxes";
import { chains, tokens } from "./utils/constant";

export default function TwoFrames({
  selectedChain,
  setSelectedChain,
  selectedToken,
  setSelectedToken,
}) {
  return (
    <div>
      <dl className="grid md:grid-cols-2">
        <ListBoxes
          chains={tokens}
          selected={selectedToken}
          setSelected={setSelectedToken}
        />
        <ListBoxes
          chains={chains}
          selected={selectedChain}
          setSelected={setSelectedChain}
        />
      </dl>
    </div>
  );
}
