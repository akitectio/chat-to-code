/**
 * Chat-to-Code Frontend Application
 */

// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const elements = {
  // Main containers
  welcomeScreen: document.getElementById('welcome-screen'),
  chatContainer: document.getElementById('chat-container'),
  infoPanel: document.getElementById('info-panel'),
  sidebar: document.querySelector('.sidebar'),
  
  // Project list
  projectsList: document.getElementById('projects'),
  
  // Chat elements
  projectTitle: document.getElementById('project-title'),
  projectId: document.getElementById('project-id'),
  projectStatus: document.getElementById('project-status'),
  chatMessages: document.getElementById('chat-messages'),
  messageInput: document.getElementById('message-input'),
  sendMessageBtn: document.getElementById('send-message-btn'),
  
  // Info panel elements
  projectDescription: document.getElementById('project-description'),
  projectCreatedAt: document.getElementById('project-created-at'),
  projectUpdatedAt: document.getElementById('project-updated-at'),
  projectTasks: document.getElementById('project-tasks'),
  projectTests: document.getElementById('project-tests'),
  projectArtifacts: document.getElementById('project-artifacts'),
  artifactTabs: document.querySelectorAll('.tab-btn'),
  
  // Buttons
  newProjectBtn: document.getElementById('new-project-btn'),
  welcomeNewProjectBtn: document.getElementById('welcome-new-project-btn'),
  closeInfoBtn: document.getElementById('close-info-btn'),
  
  // Modals
  newProjectModal: document.getElementById('new-project-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelProjectBtn: document.getElementById('cancel-project-btn'),
  newProjectForm: document.getElementById('new-project-form'),
  projectNameInput: document.getElementById('project-name'),
  projectDescInput: document.getElementById('project-desc'),
  
  artifactModal: document.getElementById('artifact-modal'),
  artifactTitle: document.getElementById('artifact-title'),
  artifactContent: document.getElementById('artifact-content'),
  closeArtifactModalBtn: document.getElementById('close-artifact-modal-btn')
};

// App State
const state = {
  currentProject: null,
  projects: [],
  messages: [],
  artifacts: [],
  tasks: [],
  tests: [],
  currentArtifactType: 'code',
  workflowStatus: null
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize application
  init();
  
  // Handle button events
  elements.newProjectBtn.addEventListener('click', showNewProjectModal);
  elements.welcomeNewProjectBtn.addEventListener('click', showNewProjectModal);
  elements.closeModalBtn.addEventListener('click', hideNewProjectModal);
  elements.cancelProjectBtn.addEventListener('click', hideNewProjectModal);
  elements.newProjectForm.addEventListener('submit', handleNewProject);
  
  elements.sendMessageBtn.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  elements.closeInfoBtn.addEventListener('click', toggleInfoPanel);
  elements.closeArtifactModalBtn.addEventListener('click', hideArtifactModal);
  
  // Handle artifact tab events
  elements.artifactTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.artifactTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentArtifactType = tab.dataset.type;
      renderArtifacts();
    });
  });
});

// Socket.IO event listeners
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('message', (message) => {
  addMessage(message);
});

// Add streaming message event listeners
socket.on('agent_response_start', (data) => {
  console.log('Agent response started:', data);
  // Create a placeholder message for streaming
  const streamingMessage = {
    id: `streaming-${Date.now()}`,
    projectId: state.currentProject.id,
    role: data.agent,
    content: '',
    timestamp: new Date().toISOString(),
    isStreaming: true
  };
  
  state.messages.push(streamingMessage);
  renderMessages();
  hideTypingIndicator();
});

socket.on('agent_response_chunk', (data) => {
  console.log('Agent response chunk received');
  // Find the streaming message and update its content
  const streamingMessage = state.messages.find(msg => msg.isStreaming);
  if (streamingMessage) {
    streamingMessage.content += data.chunk;
    renderMessages();
  }
});

socket.on('agent_response_end', (data) => {
  console.log('Agent response ended:', data);
  // Find the streaming message and finalize it
  const streamingMessage = state.messages.find(msg => msg.isStreaming);
  if (streamingMessage) {
    streamingMessage.isStreaming = false;
    streamingMessage.id = data.messageId || streamingMessage.id;
    renderMessages();
  }
});

socket.on('workflow_update', (data) => {
  state.workflowStatus = data;
  updateWorkflowStatus();
});

socket.on('project_update', (project) => {
  updateProject(project);
});

// Initialization
async function init() {
  try {
    // Get projects list
    const response = await fetch('/api/projects');
    const projects = await response.json();
    
    state.projects = projects;
    renderProjects();
    
    // If there are projects, select the first one
    if (projects.length > 0) {
      selectProject(projects[0].id);
    }
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Project Functions
async function handleNewProject(e) {
  e.preventDefault();
  
  const name = elements.projectNameInput.value.trim();
  const description = elements.projectDescInput.value.trim();
  
  if (!name) return;
  
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, description })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Add new project to the list
      const newProject = {
        id: result.projectId,
        name: result.name,
        description: result.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      state.projects.push(newProject);
      renderProjects();
      selectProject(newProject.id);
      hideNewProjectModal();
      
      // Reset form
      elements.newProjectForm.reset();
    }
  } catch (error) {
    console.error('Error creating project:', error);
  }
}

async function selectProject(projectId) {
  try {
    // Get project information
    const response = await fetch(`/api/projects/${projectId}`);
    const project = await response.json();
    
    state.currentProject = project;
    
    // Get project messages
    const messagesResponse = await fetch(`/api/projects/${projectId}/messages`);
    const messages = await messagesResponse.json();
    
    state.messages = messages;
    
    // Get project artifacts
    const artifactsResponse = await fetch(`/api/projects/${projectId}/artifacts`);
    const artifacts = await artifactsResponse.json();
    
    state.artifacts = artifacts;
    
    // Get workflow status
    const workflowResponse = await fetch(`/api/projects/${projectId}/workflow`);
    const workflowStatus = await workflowResponse.json();
    
    state.workflowStatus = workflowStatus;
    
    // Filter tasks and tests from artifacts
    state.tasks = artifacts.filter(art => art.type === 'task');
    state.tests = artifacts.filter(art => art.type === 'test');
    
    // Show chat interface
    showChatInterface();
    
    // Render data
    renderProjectInfo();
    renderMessages();
    renderTasks();
    renderTests();
    renderArtifacts();
    updateWorkflowStatus();
    
    // Highlight current project
    const projectItems = elements.projectsList.querySelectorAll('li');
    projectItems.forEach(item => {
      if (item.dataset.id === projectId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  } catch (error) {
    console.error('Error selecting project:', error);
  }
}

function updateProject(project) {
  // Update project in the list
  const index = state.projects.findIndex(p => p.id === project.id);
  
  if (index !== -1) {
    state.projects[index] = project;
  } else {
    state.projects.push(project);
  }
  
  // If viewing this project, update information
  if (state.currentProject && state.currentProject.id === project.id) {
    state.currentProject = project;
    renderProjectInfo();
  }
  
  renderProjects();
}

// Message Functions
async function sendMessage() {
  const content = elements.messageInput.value.trim();
  
  if (!content || !state.currentProject) return;
  
  try {
    // Add message to the interface immediately
    const tempMessage = {
      id: 'temp-' + Date.now(),
      projectId: state.currentProject.id,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    state.messages.push(tempMessage);
    renderMessages();
    
    // Clear input content
    elements.messageInput.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send message to server
    const response = await fetch(`/api/projects/${state.currentProject.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: content })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Error sending message:', result.error);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

function addMessage(message) {
  // Check if message already exists
  const exists = state.messages.some(msg => msg.id === message.id);
  
  if (!exists) {
    state.messages.push(message);
    renderMessages();
    
    // Hide typing indicator
    hideTypingIndicator();
  }
}

// Render Functions
function renderProjects() {
  elements.projectsList.innerHTML = '';
  
  state.projects.forEach(project => {
    const li = document.createElement('li');
    li.textContent = project.name;
    li.dataset.id = project.id;
    
    if (state.currentProject && state.currentProject.id === project.id) {
      li.classList.add('active');
    }
    
    li.addEventListener('click', () => selectProject(project.id));
    
    elements.projectsList.appendChild(li);
  });
}

function renderProjectInfo() {
  if (!state.currentProject) return;
  
  elements.projectTitle.textContent = state.currentProject.name;
  elements.projectId.textContent = `ID: ${state.currentProject.id}`;
  elements.projectDescription.textContent = state.currentProject.description || 'No description';
  elements.projectCreatedAt.textContent = formatDate(state.currentProject.createdAt);
  elements.projectUpdatedAt.textContent = formatDate(state.currentProject.updatedAt);
}

function renderMessages() {
  elements.chatMessages.innerHTML = '';
  
  state.messages.forEach(message => {
    const messageEl = createMessageElement(message);
    elements.chatMessages.appendChild(messageEl);
  });
  
  // Scroll to the latest message
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function renderTasks() {
  elements.projectTasks.innerHTML = '';
  
  if (state.tasks.length === 0) {
    elements.projectTasks.innerHTML = '<p>No tasks yet</p>';
    return;
  }
  
  state.tasks.forEach(task => {
    const taskData = JSON.parse(task.content);
    
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
      <div class="task-title">${taskData.title}</div>
      <div class="task-meta">
        <span>${taskData.type} - ${taskData.priority}</span>
        <span class="task-status status-${taskData.status}">${taskData.status}</span>
      </div>
    `;
    
    li.addEventListener('click', () => showArtifactModal(task.name, task.content));
    
    elements.projectTasks.appendChild(li);
  });
}

function renderTests() {
  elements.projectTests.innerHTML = '';
  
  if (state.tests.length === 0) {
    elements.projectTests.innerHTML = '<p>No tests yet</p>';
    return;
  }
  
  state.tests.forEach(test => {
    const testData = JSON.parse(test.content);
    
    const li = document.createElement('li');
    li.className = 'test-item';
    li.innerHTML = `
      <div class="test-title">${testData.title}</div>
      <div class="test-meta">
        <span>${testData.type}</span>
        <span class="test-status status-${testData.status}">${testData.status}</span>
      </div>
    `;
    
    li.addEventListener('click', () => showArtifactModal(test.name, test.content));
    
    elements.projectTests.appendChild(li);
  });
}

function renderArtifacts() {
  elements.projectArtifacts.innerHTML = '';
  
  const filteredArtifacts = state.artifacts.filter(art => art.type === state.currentArtifactType);
  
  if (filteredArtifacts.length === 0) {
    elements.projectArtifacts.innerHTML = `<p>No ${state.currentArtifactType} artifacts yet</p>`;
    return;
  }
  
  filteredArtifacts.forEach(artifact => {
    const li = document.createElement('li');
    li.className = 'artifact-item';
    li.innerHTML = `
      <div class="artifact-title">${artifact.name}</div>
      <div class="artifact-meta">
        <span>${formatDate(artifact.timestamp)}</span>
      </div>
    `;
    
    li.addEventListener('click', () => showArtifactModal(artifact.name, artifact.content));
    
    elements.projectArtifacts.appendChild(li);
  });
}

function updateWorkflowStatus() {
  if (!state.workflowStatus) return;
  
  const { status } = state.workflowStatus;
  
  elements.projectStatus.textContent = status;
  
  if (status === 'running') {
    elements.projectStatus.className = 'status-pending';
  } else if (status === 'completed') {
    elements.projectStatus.className = 'status-completed';
  } else if (status === 'failed') {
    elements.projectStatus.className = 'status-failed';
  }
}

// UI Helper Functions
function showChatInterface() {
  elements.welcomeScreen.style.display = 'none';
  elements.chatContainer.style.display = 'flex';
  elements.infoPanel.style.display = 'flex';
}

function showNewProjectModal() {
  elements.newProjectModal.classList.add('show');
  elements.projectNameInput.focus();
}

function hideNewProjectModal() {
  elements.newProjectModal.classList.remove('show');
}

function showArtifactModal(title, content) {
  elements.artifactTitle.textContent = title;
  
  try {
    // If content is JSON, format it
    const parsedContent = JSON.parse(content);
    elements.artifactContent.textContent = JSON.stringify(parsedContent, null, 2);
  } catch (e) {
    // If not JSON, display as is
    elements.artifactContent.textContent = content;
  }
  
  // Highlight code if highlight.js library is available
  if (window.hljs) {
    hljs.highlightElement(elements.artifactContent);
  }
  
  elements.artifactModal.classList.add('show');
}

function hideArtifactModal() {
  elements.artifactModal.classList.remove('show');
}

function toggleInfoPanel() {
  elements.infoPanel.classList.toggle('show');
}

function showTypingIndicator() {
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.id = 'typing-indicator';
  typingIndicator.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;
  
  // Remove existing typing indicator if any
  const existingIndicator = document.getElementById('typing-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  elements.chatMessages.appendChild(typingIndicator);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Utility Functions
function createMessageElement(message) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  
  // Set avatar text based on role
  if (message.role === 'user') {
    avatar.textContent = 'U';
  } else if (message.role === 'ba') {
    avatar.textContent = 'BA';
  } else if (message.role === 'dev') {
    avatar.textContent = 'D';
  } else if (message.role === 'tester') {
    avatar.textContent = 'T';
  } else {
    avatar.textContent = message.role.charAt(0).toUpperCase();
  }
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = getRoleName(message.role);
  
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = formatTime(message.timestamp);
  
  header.appendChild(name);
  header.appendChild(time);
  
  const body = document.createElement('div');
  body.className = 'message-body';
  
  // Render markdown if the library is available
  if (window.marked) {
    body.innerHTML = marked.parse(message.content);
  } else {
    body.textContent = message.content;
  }
  
  // Add blinking cursor for streaming messages
  if (message.isStreaming) {
    const cursor = document.createElement('span');
    cursor.className = 'blinking-cursor';
    cursor.textContent = '▋';
    body.appendChild(cursor);
  }
  
  // Highlight code blocks if the library is available
  if (window.hljs) {
    const codeBlocks = body.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      hljs.highlightElement(block);
    });
  }
  
  content.appendChild(header);
  content.appendChild(body);
  
  messageEl.appendChild(avatar);
  messageEl.appendChild(content);
  
  return messageEl;
}

function getRoleName(role) {
  switch (role) {
    case 'user': return 'User';
    case 'ba': return 'Business Analyst';
    case 'dev': return 'Developer';
    case 'tester': return 'Tester';
    default: return role;
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}