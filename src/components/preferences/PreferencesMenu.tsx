import React, { useState, useRef, useEffect } from "react";
import { useTheme, type Theme } from "../../contexts/ThemeContext";
import "./PreferencesMenu.css";
import { MoonIcon,SunIcon, ThreeDotsIcon } from "../UI";

const PreferencesMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  const themeOptions = [
    {
      value: "auto" as Theme,
      label: "Auto",
      icon: "Auto",
    },
    {
      value: "light" as Theme,
      label: "Light",
      icon: (
        <SunIcon/>
      ),
    },
    {
      value: "dark" as Theme,
      label: "Dark",
      icon: (
        <MoonIcon/>
      ),
    },
  ];

  return (
    <div className="preferences-menu" ref={menuRef}>
      <button
        className="preferences-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open preferences"
      >
        <ThreeDotsIcon/>
      </button>

      {isOpen && (
        <div className="preferences-dropdown">
          <div className="preferences-header">
            <h3>Global preferences</h3>
          </div>

          <div className="preferences-content">
            <div className="preference-group">
              <div className="preference-label">
                <span>Theme</span>
              </div>
                <div className="theme-selector">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`theme-option ${
                        theme === option.value ? "active" : ""
                      }`}
                      onClick={() => handleThemeChange(option.value)}
                    >
                      <span className="theme-icon">{option.icon}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreferencesMenu;
