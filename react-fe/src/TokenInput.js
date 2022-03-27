export default function TokenInput({ amount, setAmount }) {
  const onChange = (e) => {
    const re = /^[.,0-9]+$/;
    if (e.target.value === "" || re.test(e.target.value)) {
      setAmount(e.target.value);
    }
  };
  return (
    <div>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type="text"
          name="price"
          id="price"
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
          placeholder="0.00"
          aria-describedby="price-currency"
          onChange={onChange}
          value={amount}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-black bg-gray-300 hover:bg-gray-400"
            id="price-currency"
            type="button"
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}
