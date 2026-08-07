const GlobalPageLoader = ({ overlay = false }) => {
  return (
    <div
      className={
        overlay
          ? 'global-page-loader global-page-loader--overlay'
          : 'global-page-loader global-page-loader--page'
      }
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="global-page-loader__bar" />
      <div className="global-page-loader__card" role="status">
        <div className="global-page-loader__mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="sr-only">Loading page</span>
      </div>
    </div>
  )
}

export default GlobalPageLoader
