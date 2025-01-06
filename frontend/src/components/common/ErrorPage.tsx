export interface ErrorPageProps {
  errorMessage?: string;
  statusCode?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ errorMessage = "Something is wrong.", statusCode = "" }) => {
  return (
    <div>
      <div className="flex min-h-screen flex-col items-center p-24 pt-0">
        <div className="flex flex-row text-3xl font-medium items-center self-start">
          <div className="flex flex-col">
            <div className="font-extrabold">
              <h1>RNA</h1>
            </div>
            <div className="font-semibold pr-5">
              <h1>MOLEY</h1>
            </div>
          </div>
          <h1>| Error</h1>
        </div>
        <span className="p-24">
          <div className="flex flex-col items-center text-4xl font-bold">
            <h1 className="flex justify-center text-teal-600 p-5">
              Error {statusCode}
            </h1>
            <span className="font-normal text-2xl">{errorMessage}</span>
          </div>
        </span>
      </div>
    </div>
  );
};

export default ErrorPage;
