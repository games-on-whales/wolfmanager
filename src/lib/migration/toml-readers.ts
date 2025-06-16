/**
 * TOML File Readers
 * 
 * Functions to read and parse TOML configuration files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import {
  DefaultConfigToml,
  SteamLibraryToml,
  TasksConfigToml,
  FileValidationResult
} from './types';

/**
 * Base path for configuration files
 */
const CONFIG_BASE_PATH = path.join(process.cwd(), 'config');

/**
 * Read and parse default configuration TOML
 */
export async function readDefaultConfig(): Promise<DefaultConfigToml | null> {
  const filePath = path.join(CONFIG_BASE_PATH, 'default.toml');
  
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Default config file not found: ${filePath}`);
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedData = toml.parse(fileContent);
    
    // Validate the structure
    if (!parsedData.system || !parsedData.users) {
      throw new Error('Invalid default.toml structure: missing system or users sections');
    }

    return parsedData as DefaultConfigToml;
  } catch (error) {
    console.error(`Error reading default config: ${error}`);
    return null;
  }
}

/**
 * Read and parse Steam library TOML
 */
export async function readSteamLibrary(): Promise<SteamLibraryToml | null> {
  const filePath = path.join(CONFIG_BASE_PATH, 'libraries', 'steam.toml');
  
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Steam library file not found: ${filePath}`);
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedData = toml.parse(fileContent);
    
    // Validate the structure
    if (!parsedData.metadata || !parsedData.games) {
      throw new Error('Invalid steam.toml structure: missing metadata or games sections');
    }

    return parsedData as SteamLibraryToml;
  } catch (error) {
    console.error(`Error reading Steam library config: ${error}`);
    return null;
  }
}

/**
 * Read and parse tasks configuration TOML
 */
export async function readTasksConfig(): Promise<TasksConfigToml | null> {
  const filePath = path.join(CONFIG_BASE_PATH, 'tasks.toml');
  
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Tasks config file not found: ${filePath}`);
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedData = toml.parse(fileContent);
    
    // Validate the structure
    if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) {
      throw new Error('Invalid tasks.toml structure: missing or invalid tasks array');
    }

    return parsedData as TasksConfigToml;
  } catch (error) {
    console.error(`Error reading tasks config: ${error}`);
    return null;
  }
}

/**
 * Validate TOML data against expected schema
 */
export function validateTomlData(data: any, schema: string): boolean {
  try {
    switch (schema) {
      case 'default':
        return !!(data?.system?.name && data?.users && typeof data.users === 'object');
      
      case 'steam':
        return !!(data?.metadata?.platform && data?.games && typeof data.games === 'object');
      
      case 'tasks':
        return !!(data?.tasks && Array.isArray(data.tasks));
      
      default:
        return false;
    }
  } catch (error) {
    console.error(`Validation error for schema ${schema}:`, error);
    return false;
  }
}

/**
 * Check if a TOML file exists and is valid
 */
export async function validateTomlFile(filePath: string, schema: string): Promise<FileValidationResult> {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(CONFIG_BASE_PATH, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return {
        exists: false,
        valid: false,
        error: `File does not exist: ${fullPath}`
      };
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const parsedData = toml.parse(fileContent);
    const isValid = validateTomlData(parsedData, schema);

    return {
      exists: true,
      valid: isValid,
      data: isValid ? parsedData : undefined,
      error: isValid ? undefined : `Invalid TOML structure for schema: ${schema}`
    };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      error: `Error parsing TOML file: ${error}`
    };
  }
}

/**
 * Get all available TOML configuration files
 */
export async function getAvailableTomlFiles(): Promise<{
  defaultConfig: FileValidationResult;
  steamLibrary: FileValidationResult;
  tasksConfig: FileValidationResult;
}> {
  const [defaultConfig, steamLibrary, tasksConfig] = await Promise.all([
    validateTomlFile('default.toml', 'default'),
    validateTomlFile('libraries/steam.toml', 'steam'),
    validateTomlFile('tasks.toml', 'tasks')
  ]);

  return {
    defaultConfig,
    steamLibrary,
    tasksConfig
  };
}

/**
 * Read all TOML configuration files
 */
export async function readAllTomlConfigs(): Promise<{
  defaultConfig: DefaultConfigToml | null;
  steamLibrary: SteamLibraryToml | null;
  tasksConfig: TasksConfigToml | null;
}> {
  const [defaultConfig, steamLibrary, tasksConfig] = await Promise.all([
    readDefaultConfig(),
    readSteamLibrary(),
    readTasksConfig()
  ]);

  return {
    defaultConfig,
    steamLibrary,
    tasksConfig
  };
}