import { useAppStore } from '../../store/useAppStore'
import logoUrl from '../../assets/logo.svg'

export default function WelcomeScreen() {
  const addProject = useAppStore((s) => s.addProject)

  const handleOpenFolder = async () => {
    const folderPath = await window.electronAPI.openFolderDialog()
    if (folderPath) {
      await addProject(folderPath)
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <img className="welcome-logo" src={logoUrl} alt="CodeEdit" />
        <h1 className="welcome-title">CodeEdit</h1>
        <p className="welcome-subtitle">轻量、多项目、内置终端的桌面代码工作台</p>
        <div className="welcome-actions">
          <button className="welcome-btn" onClick={handleOpenFolder}>
            打开项目文件夹
          </button>
        </div>
      </div>
    </div>
  )
}
